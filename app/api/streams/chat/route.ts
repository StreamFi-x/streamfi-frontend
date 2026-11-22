import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";
import { verifySession } from "@/lib/auth/verify-session";
import { CACHE_POLICIES, cacheHeaders } from "@/lib/cache";
import { createCache, createMemoryBackend } from "@/lib/cache/store";
import {
  buildPage,
  decodeCursor,
  encodeCursor,
  keysetBounds,
  readPageParams,
  type KeysetRow,
  type PageParams,
} from "@/lib/pagination/cursor";
import { publishRealtimeMessage } from "@/lib/realtime/pubsub";
import {
  recordAndGetSpikeLevel,
  getSpikeLevelForStream,
  recordConnectionRate,
  getEffectiveSlowMode,
  getPollIntervalSeconds,
} from "@/lib/chat-spike";

// 30 messages per minute per IP prevents chat spam
const isRateLimited = createRateLimiter(60_000, 30);

// 120 deletes per minute per authenticated user — generous enough for a
// spam-wave clear (moderator removing ~2 msg/s) but caps worst-case damage
// if credentials are compromised (#763). Keyed on userId, not IP, so the
// limit tracks the moderator identity rather than a shared proxy address.
const isDeleteRateLimited = createRateLimiter(60_000, 120);

const DEFAULT_LIMIT = 50;
/** The live chat view polls the newest 200 messages; keep that possible. */
const MAX_LIMIT = 200;

const chatWindowCache = createCache(createMemoryBackend());
const chatTag = (playbackId: string) => `chat:${playbackId}`;

export interface StreamModerationPolicy {
  moderators: Set<string>;
  bannedUsers: Set<string>;
  mutedUsers: Map<string, number>; // userId -> expiresAtMs
  slowModeSeconds: number;
  wordFilter: string[];
  lastMessageAtByUser: Map<string, number>; // userId -> timestampMs
}

const streamModerationStore = new Map<string, StreamModerationPolicy>();

function getOrCreateModerationPolicy(streamKey: string): StreamModerationPolicy {
  let policy = streamModerationStore.get(streamKey);
  if (!policy) {
    policy = {
      moderators: new Set<string>(),
      bannedUsers: new Set<string>(),
      mutedUsers: new Map<string, number>(),
      slowModeSeconds: 0,
      wordFilter: [],
      lastMessageAtByUser: new Map<string, number>(),
    };
    streamModerationStore.set(streamKey, policy);
  }
  return policy;
}

export function resetChatModerationState(): void {
  streamModerationStore.clear();
}

function parseStringList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(v => String(v).trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(v => String(v).trim()).filter(Boolean);
      }
    } catch {
      return raw
        .split(",")
        .map(v => v.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function parseMutedMap(raw: unknown): Record<string, number> {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const ts = typeof v === "number" ? v : Date.parse(String(v));
      if (Number.isFinite(ts)) {
        out[k] = ts;
      }
    }
    return out;
  }
  if (typeof raw === "string") {
    try {
      return parseMutedMap(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  return {};
}

function isUserStreamModerator(params: {
  playbackId?: string;
  streamerId?: string;
  userId: string;
  userRole?: string | null;
  dbModerators?: unknown;
}): boolean {
  if (params.userRole === "moderator" || params.userRole === "admin") {
    return true;
  }
  const dbMods = parseStringList(params.dbModerators);
  if (dbMods.includes(String(params.userId))) {
    return true;
  }
  for (const key of [params.playbackId, params.streamerId].filter(Boolean)) {
    const policy = streamModerationStore.get(String(key));
    if (policy?.moderators.has(String(params.userId))) {
      return true;
    }
  }
  return false;
}

function containsFilteredWord(content: string, words: string[]): boolean {
  if (words.length === 0) return false;
  const normalizedContent = content.toLowerCase();
  for (const word of words) {
    const target = word.trim().toLowerCase();
    if (!target) continue;
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|\\b|\\s)${escaped}(?:$|\\b|\\s)`, "i");
    if (regex.test(normalizedContent)) {
      return true;
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  // Verify caller identity server-side via session
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const {
      wallet,
      playbackId,
      content,
      messageType = "message",
    } = await req.json();

    if (!playbackId || !content) {
      return NextResponse.json(
        { error: "Playback ID and content are required" },
        { status: 400 }
      );
    }

    // Never trust client-supplied wallet if it contradicts the verified session
    if (
      wallet &&
      session.wallet &&
      session.wallet.toLowerCase() !== wallet.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Forbidden: wallet mismatch" },
        { status: 403 }
      );
    }

    if (content.length > 500) {
      return NextResponse.json(
        { error: "Message must be 500 characters or less" },
        { status: 400 }
      );
    }

    if (!["message", "emote", "system"].includes(messageType)) {
      return NextResponse.json(
        { error: "Invalid message type" },
        { status: 400 }
      );
    }

    // Derive sender strictly from verified session user
    const result = await sql`
      SELECT
        sender.id AS sender_id,
        sender.username AS sender_username,
        sender.wallet AS sender_wallet,
        sender.role AS sender_role,
        streamer.id AS streamer_id,
        streamer.is_live,
        streamer.creator->>'chatSlowModeSeconds' AS chat_slow_mode_seconds,
        streamer.creator->>'chatSubscriberOnly'  AS chat_subscriber_only,
        streamer.creator->'chatModerators'       AS chat_moderators,
        streamer.creator->'chatBannedUsers'      AS chat_banned_users,
        streamer.creator->'chatMutedUsers'       AS chat_muted_users,
        streamer.creator->'chatWordFilter'       AS chat_word_filter,
        (
          SELECT ss.id FROM stream_sessions ss
          WHERE ss.user_id = streamer.id AND ss.ended_at IS NULL
          ORDER BY ss.started_at DESC LIMIT 1
        ) AS session_id
      FROM users sender
      CROSS JOIN users streamer
      WHERE sender.id = ${session.userId}
        AND streamer.mux_playback_id = ${playbackId}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "User or stream not found" },
        { status: 404 }
      );
    }

    const {
      sender_id,
      sender_username,
      is_live,
      session_id,
      streamer_id,
      chat_slow_mode_seconds,
      sender_role,
      chat_moderators,
      chat_banned_users,
      chat_muted_users,
      chat_word_filter,
    } = result.rows[0];

    if (!is_live) {
      return NextResponse.json(
        { error: "Cannot send message to offline stream" },
        { status: 409 }
      );
    }

    if (!session_id) {
      return NextResponse.json(
        { error: "No active stream session" },
        { status: 404 }
      );
    }

    const senderKey = String(sender_id ?? session.userId);
    const policy = getOrCreateModerationPolicy(playbackId);
    const isOwner =
      streamer_id !== undefined && String(streamer_id) === senderKey;
    const isModerator = isUserStreamModerator({
      playbackId,
      streamerId: streamer_id ? String(streamer_id) : undefined,
      userId: senderKey,
      userRole: sender_role,
      dbModerators: chat_moderators,
    });

    // 1. Check persistent ban list (DB + runtime moderation state)
    const dbBanned = parseStringList(chat_banned_users);
    if (policy.bannedUsers.has(senderKey) || dbBanned.includes(senderKey)) {
      return NextResponse.json(
        { error: "You are banned from chatting in this stream" },
        { status: 403 }
      );
    }

    // 2. Check time-boxed mute / timeout (DB + runtime moderation state)
    const nowMs = Date.now();
    const dbMuted = parseMutedMap(chat_muted_users);
    const mutedUntilMs = Math.max(
      policy.mutedUsers.get(senderKey) ?? 0,
      dbMuted[senderKey] ?? 0
    );
    if (mutedUntilMs > nowMs) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((mutedUntilMs - nowMs) / 1000)
      );
      return NextResponse.json(
        {
          error: "You are temporarily timed out from chatting in this stream",
          retryAfter: retryAfterSeconds,
        },
        {
          status: 403,
          headers: { "Retry-After": String(retryAfterSeconds) },
        }
      );
    } else if (policy.mutedUsers.has(senderKey)) {
      policy.mutedUsers.delete(senderKey);
    }

    // 3. Check optional per-stream word / profanity filter
    const combinedWordFilter = [
      ...policy.wordFilter,
      ...parseStringList(chat_word_filter),
    ];
    if (containsFilteredWord(content, combinedWordFilter)) {
      return NextResponse.json(
        { error: "Message contains filtered or prohibited words" },
        { status: 400 }
      );
    }

    const spikeLevel = streamer_id
      ? await recordAndGetSpikeLevel(String(streamer_id)).catch(() => "normal" as const)
      : ("normal" as const);

    // 4. Enforce per-stream slow mode for regular chatters (owners & moderators exempt)
    const configuredSlowMode = Math.max(
      policy.slowModeSeconds,
      parseInt(String(chat_slow_mode_seconds ?? "0"), 10) || 0
    );
    const effectiveSlowModeSeconds =
      configuredSlowMode > 0
        ? getEffectiveSlowMode(configuredSlowMode, spikeLevel)
        : 0;

    if (effectiveSlowModeSeconds > 0 && !isOwner && !isModerator) {
      const lastSentAt = policy.lastMessageAtByUser.get(senderKey) ?? 0;
      const elapsedMs = nowMs - lastSentAt;
      const requiredMs = effectiveSlowModeSeconds * 1000;
      if (lastSentAt > 0 && elapsedMs < requiredMs) {
        const retryAfter = Math.max(
          1,
          Math.ceil((requiredMs - elapsedMs) / 1000)
        );
        return NextResponse.json(
          {
            error: `Slow mode is active: please wait ${retryAfter}s before sending another message`,
            retryAfter,
          },
          {
            status: 429,
            headers: { "Retry-After": String(retryAfter) },
          }
        );
      }
    }

    policy.lastMessageAtByUser.set(senderKey, nowMs);

    // Single atomic statement: the INSERT and the counter increment are in the
    // same implicit transaction, so a crash or connection drop between them
    // can never leave total_messages permanently out of sync (#764).
    const messageResult = await sql`
      WITH new_msg AS (
        INSERT INTO chat_messages (
          user_id,
          username,
          stream_session_id,
          content,
          message_type,
          created_at
        )
        VALUES (${sender_id}, ${sender_username}, ${session_id}, ${content}, ${messageType}, CURRENT_TIMESTAMP)
        RETURNING id, created_at, stream_session_id
      ),
      _counter AS (
        UPDATE stream_sessions
        SET total_messages = total_messages + 1
        WHERE id = (SELECT stream_session_id FROM new_msg)
      )
      SELECT id, created_at FROM new_msg
    `;

    const newMessage = messageResult.rows[0];
    await chatWindowCache.invalidate([chatTag(playbackId)]);

    const formattedMessage = {
      id: newMessage.id,
      content,
      messageType,
      user: {
        username: sender_username,
        wallet: wallet,
      },
      createdAt: newMessage.created_at,
    };

    // Publish to Realtime Pub/Sub channel for instantaneous push delivery (#1450)
    publishRealtimeMessage(
      `stream:${playbackId}:chat`,
      "chat:message",
      formattedMessage
    ).catch(e => console.error("[chat] Realtime publish error:", e));

    return NextResponse.json(
      {
        message: "Message sent successfully",
        chatMessage: formattedMessage,
      },
      { status: 201, headers: { "X-Chat-Spike": spikeLevel } }
    );
  } catch (error) {
    console.error("Chat message error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

interface ChatRow extends KeysetRow {
  content: string;
  message_type: string;
  created_at: string;
  username: string;
  wallet: string;
  avatar: string | null;
}

async function loadChatPage(playbackId: string, page: PageParams) {
  const streamResult = await sql`
    SELECT ss.id as session_id
    FROM users u
    JOIN stream_sessions ss ON u.id = ss.user_id AND ss.ended_at IS NULL
    WHERE u.mux_playback_id = ${playbackId}
    ORDER BY ss.started_at DESC
    LIMIT 1
  `;

  if (streamResult.rows.length === 0) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  const sessionId = streamResult.rows[0].session_id;
  const bound = keysetBounds(page.after);
  const messagesResult = await sql<ChatRow>`
    SELECT
      cm.id,
      cm.content,
      cm.message_type,
      cm.created_at,
      to_char(cm.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts,
      COALESCE(u.username, 'deleted user') AS username,
      COALESCE(u.wallet, '') AS wallet,
      u.avatar
    FROM chat_messages cm
    LEFT JOIN users u ON cm.user_id = u.id
    WHERE cm.stream_session_id = ${sessionId}
      AND cm.is_deleted = false
      AND (cm.created_at, cm.id) < (${bound.ts}::timestamptz, ${bound.id}::uuid)
    ORDER BY cm.created_at DESC, cm.id DESC
    LIMIT ${page.limit + 1}
  `;

  return buildPage(messagesResult.rows, page.limit, msg => ({
    id: msg.id,
    content: msg.content,
    messageType: msg.message_type,
    createdAt: msg.created_at,
    user: {
      username: msg.username,
      wallet: msg.wallet,
      avatar: msg.avatar,
    },
  }));
}

/**
 * Chat history, newest first, on the shared cursor contract
 * (docs/api/pagination.md): `?playbackId&limit&cursor` →
 * `{ items, nextCursor, hasMore }`. Polling clients request the first page;
 * `nextCursor` walks back through older history.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const playbackId = searchParams.get("playbackId");

    if (!playbackId) {
      return NextResponse.json(
        { error: "Playback ID is required" },
        { status: 400 }
      );
    }

    if (searchParams.has("before") && !searchParams.has("cursor")) {
      const beforeVal = searchParams.get("before")!;
      try {
        decodeCursor(beforeVal);
        searchParams.set("cursor", beforeVal);
        searchParams.delete("before");
      } catch {
        if (
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            beforeVal
          )
        ) {
          const msgLookup = await sql`
            SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts
            FROM chat_messages
            WHERE id = ${beforeVal}::uuid
            LIMIT 1
          `;
          if (msgLookup.rows.length > 0) {
            searchParams.set(
              "cursor",
              encodeCursor({
                ts: msgLookup.rows[0].cursor_ts,
                id: beforeVal.toLowerCase(),
              })
            );
            searchParams.delete("before");
          } else {
            return NextResponse.json(
              { error: "Message specified in before cursor not found" },
              { status: 404 }
            );
          }
        } else {
          return NextResponse.json(
            { error: "Invalid before cursor format; provide a valid UUID or cursor" },
            { status: 400 }
          );
        }
      }
    }

    const params = readPageParams(searchParams, {
      defaultLimit: DEFAULT_LIMIT,
      maxLimit: MAX_LIMIT,
    });
    if (!params.ok) {
      return params.response;
    }
    const { page } = params;

    const result = await chatWindowCache.getOrLoad(
      {
        key: `chat:${playbackId}:${page.limit}:${searchParams.get("cursor") ?? "live"}`,
        tags: [chatTag(playbackId)],
        ttlSeconds: CACHE_POLICIES.chatWindow.appTtlSeconds,
      },
      () => loadChatPage(playbackId, page)
    );

    // Resolve streamerId for spike-level signals. A missing/failed lookup is
    // non-fatal: we simply omit the spike headers rather than erroring.
    let spikeHeaders: Record<string, string> = {};
    try {
      const streamerRow = await sql`
        SELECT id FROM users WHERE mux_playback_id = ${playbackId} LIMIT 1
      `;
      if (streamerRow && streamerRow.rows && streamerRow.rows.length > 0) {
        const streamerId: string = streamerRow.rows[0].id;
        const connLevel = await recordConnectionRate(streamerId);
        const msgLevel = await getSpikeLevelForStream(streamerId);
        const effectiveLevel =
          connLevel === "critical" || msgLevel === "critical"
            ? "critical"
            : connLevel === "degraded" || msgLevel === "degraded"
              ? "degraded"
              : "normal";
        spikeHeaders = {
          "X-Chat-Spike": effectiveLevel,
          "X-Poll-Interval": String(getPollIntervalSeconds(effectiveLevel)),
        };
      }
    } catch {
      // Non-fatal: spike headers are best-effort.
    }

    return NextResponse.json(result, {
      status: 200,
      headers: { ...cacheHeaders("chatWindow"), ...spikeHeaders },
    });
  } catch (error) {
    console.error("Get chat messages error:", error);
    return NextResponse.json(
      { error: "Failed to get messages" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Authenticate moderator via verified server session
    const session = await verifySession(req);
    if (!session.ok) {
      return session.response;
    }

    if (await isDeleteRateLimited(session.userId)) {
      return NextResponse.json(
        { error: "Too many delete requests" },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const { messageId, moderatorWallet } = await req.json();

    if (!messageId) {
      return NextResponse.json(
        { error: "Message ID is required" },
        { status: 400 }
      );
    }

    // Prevent spoofing moderator wallet
    if (
      moderatorWallet &&
      session.wallet &&
      session.wallet.toLowerCase() !== moderatorWallet.toLowerCase()
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const messageResult = await sql`
      SELECT 
        cm.id,
        cm.user_id as message_user_id,
        ss.user_id as stream_owner_id,
        owner.mux_playback_id,
        owner.creator->'chatModerators' as chat_moderators
      FROM chat_messages cm
      JOIN stream_sessions ss ON cm.stream_session_id = ss.id
      JOIN users owner ON owner.id = ss.user_id
      WHERE cm.id = ${messageId} AND cm.is_deleted = false
    `;

    if (messageResult.rows.length === 0) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const message = messageResult.rows[0];

    // Check permissions against verified session.userId (stream owner, message author, or assigned moderator)
    const isOwner = String(session.userId) === String(message.stream_owner_id);
    const isAuthor = String(session.userId) === String(message.message_user_id);
    const isModerator = isUserStreamModerator({
      playbackId: message.mux_playback_id,
      streamerId: message.stream_owner_id
        ? String(message.stream_owner_id)
        : undefined,
      userId: String(session.userId),
      dbModerators: message.chat_moderators,
    });

    if (!isOwner && !isAuthor && !isModerator) {
      return NextResponse.json(
        { error: "Insufficient permissions to delete this message" },
        { status: 403 }
      );
    }

    await sql`
      UPDATE chat_messages SET
        is_deleted = true,
        is_moderated = true,
        moderated_by = ${session.userId}
      WHERE id = ${messageId}
    `;
    if (message.mux_playback_id) {
      await chatWindowCache.invalidate([chatTag(message.mux_playback_id)]);
    }

    return NextResponse.json(
      { message: "Message deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete chat message error:", error);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}

/**
 * Moderation control endpoint (#1851):
 * Supports distinct moderator role assignment, time-boxed mutes/timeouts,
 * persistent bans, per-stream slow mode, and configurable word filters.
 */
export async function PATCH(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const body = await req.json();
    const {
      playbackId,
      action,
      targetUserId,
      durationSeconds,
      slowModeSeconds,
      words,
    } = body ?? {};

    if (!playbackId || !action) {
      return NextResponse.json(
        { error: "playbackId and action are required" },
        { status: 400 }
      );
    }

    const streamLookup = await sql`
      SELECT id, creator->'chatModerators' AS chat_moderators
      FROM users
      WHERE mux_playback_id = ${playbackId}
      LIMIT 1
    `;

    if (streamLookup.rows.length === 0) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    const streamOwner = streamLookup.rows[0];
    const isOwner = String(streamOwner.id) === String(session.userId);
    const isModerator = isUserStreamModerator({
      playbackId,
      streamerId: String(streamOwner.id),
      userId: String(session.userId),
      dbModerators: streamOwner.chat_moderators,
    });

    if (!isOwner && !isModerator) {
      return NextResponse.json(
        { error: "Forbidden: moderator or stream owner permissions required" },
        { status: 403 }
      );
    }

    const policy = getOrCreateModerationPolicy(playbackId);

    switch (action) {
      case "add_moderator": {
        if (!isOwner) {
          return NextResponse.json(
            { error: "Only the stream owner can assign moderators" },
            { status: 403 }
          );
        }
        if (!targetUserId) {
          return NextResponse.json(
            { error: "targetUserId is required" },
            { status: 400 }
          );
        }
        policy.moderators.add(String(targetUserId));
        return NextResponse.json({
          message: "Moderator added",
          moderators: Array.from(policy.moderators),
        });
      }
      case "remove_moderator": {
        if (!isOwner) {
          return NextResponse.json(
            { error: "Only the stream owner can remove moderators" },
            { status: 403 }
          );
        }
        if (!targetUserId) {
          return NextResponse.json(
            { error: "targetUserId is required" },
            { status: 400 }
          );
        }
        policy.moderators.delete(String(targetUserId));
        return NextResponse.json({
          message: "Moderator removed",
          moderators: Array.from(policy.moderators),
        });
      }
      case "mute":
      case "timeout": {
        if (!targetUserId) {
          return NextResponse.json(
            { error: "targetUserId is required" },
            { status: 400 }
          );
        }
        const duration = Math.max(1, Number(durationSeconds ?? 300));
        const expiresAt = Date.now() + duration * 1000;
        policy.mutedUsers.set(String(targetUserId), expiresAt);
        return NextResponse.json({
          message: "User timed out",
          targetUserId: String(targetUserId),
          expiresAt: new Date(expiresAt).toISOString(),
        });
      }
      case "unmute": {
        if (!targetUserId) {
          return NextResponse.json(
            { error: "targetUserId is required" },
            { status: 400 }
          );
        }
        policy.mutedUsers.delete(String(targetUserId));
        return NextResponse.json({
          message: "User unmuted",
          targetUserId: String(targetUserId),
        });
      }
      case "ban": {
        if (!targetUserId) {
          return NextResponse.json(
            { error: "targetUserId is required" },
            { status: 400 }
          );
        }
        policy.bannedUsers.add(String(targetUserId));
        return NextResponse.json({
          message: "User banned from stream chat",
          targetUserId: String(targetUserId),
        });
      }
      case "unban": {
        if (!targetUserId) {
          return NextResponse.json(
            { error: "targetUserId is required" },
            { status: 400 }
          );
        }
        policy.bannedUsers.delete(String(targetUserId));
        return NextResponse.json({
          message: "User unbanned from stream chat",
          targetUserId: String(targetUserId),
        });
      }
      case "set_slow_mode": {
        const seconds = Math.max(0, Number(slowModeSeconds ?? 0));
        policy.slowModeSeconds = seconds;
        return NextResponse.json({
          message: "Slow mode updated",
          slowModeSeconds: seconds,
        });
      }
      case "set_word_filter": {
        if (!Array.isArray(words)) {
          return NextResponse.json(
            { error: "words must be an array of strings" },
            { status: 400 }
          );
        }
        policy.wordFilter = words
          .map(w => String(w).trim())
          .filter(Boolean);
        return NextResponse.json({
          message: "Word filter updated",
          wordFilter: policy.wordFilter,
        });
      }
      default:
        return NextResponse.json(
          { error: `Unsupported moderation action: ${String(action)}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Chat moderation error:", error);
    return NextResponse.json(
      { error: "Failed to apply moderation action" },
      { status: 500 }
    );
  }
}
