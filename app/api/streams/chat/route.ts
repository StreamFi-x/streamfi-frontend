import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";
import { verifySession } from "@/lib/auth/verify-session";
import { CACHE_POLICIES, cacheHeaders } from "@/lib/cache";
import { createCache, createMemoryBackend } from "@/lib/cache/store";
import { getUpstashRedis } from "@/lib/upstash-redis";
import {
  buildPage,
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

const DEFAULT_LIMIT = 50;
/** The live chat view polls the newest 200 messages; keep that possible. */
const MAX_LIMIT = 200;

// Every viewer of a stream polls the same window once a second. The edge
// (chatWindow policy) collapses those per region; this per-instance cache
// collapses whatever reaches one instance into one query per second per
// stream. It is deliberately not Redis: at one command per poll the Redis bill
// would scale with viewers, which is the cost we are trying to remove.
// docs/postgres-pooling-and-chat-load.md has the measurements.
const chatWindowCache = createCache(createMemoryBackend());
const chatTag = (playbackId: string) => `chat:${playbackId}`;

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

    const { sender_id, sender_username, sender_wallet, is_live, session_id, streamer_id, chat_slow_mode_seconds, chat_subscriber_only, sender_role } =
      result.rows[0];

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

    // Per-user rate-limit backstop (moved from pre-auth IP check)
    if (await isRateLimited(session.userId)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    // Creator/mod exemption from chat mode restrictions
    const isCreator = session.userId === streamer_id;
    const isMod = sender_role === 'moderator' || sender_role === 'super_admin';
    const isExempt = isCreator || isMod;

    // Record message rate and derive spike level (before slow-mode so the
    // effective interval can be raised by the spike floor). Errors are caught
    // inside recordAndGetSpikeLevel and return 'normal', so this never throws.
    const spikeLevel = await recordAndGetSpikeLevel(streamer_id);

    // Slow mode check
    if (!isExempt) {
      const configuredSecs = parseInt(chat_slow_mode_seconds ?? '0', 10);
      // Spike can raise the floor; it never lowers the creator's setting.
      const intervalSecs = getEffectiveSlowMode(configuredSecs, spikeLevel);
      if (intervalSecs > 0) {
        const redis = getUpstashRedis();
        if (redis) {
          const key = `chat:slowmode:${streamer_id}:${session.userId}`;
          const set = await redis.set(key, '1', { nx: true, px: intervalSecs * 1000 });
          if (set === null) {
            const ttl = await redis.pttl(key);
            return NextResponse.json(
              {
                error: 'Slow mode is active. Please wait before sending another message.',
                code: 'slow_mode',
                retryAfterMs: Math.max(0, ttl),
              },
              { status: 429, headers: { "X-Chat-Spike": spikeLevel } }
            );
          }
        }
      }
    }

    // Subscriber-only check
    if (!isExempt && chat_subscriber_only === 'true') {
      const subResult = await sql`
        SELECT 1 FROM subscriptions
        WHERE subscriber_id = ${session.userId}
          AND streamer_id   = ${streamer_id}
          AND status = 'active'
          AND current_period_end > NOW()
        LIMIT 1
      `;
      if (subResult.rows.length === 0) {
        return NextResponse.json(
          {
            error: 'This chat is subscriber-only. Subscribe to the channel to participate.',
            code: 'subscriber_only',
          },
          { status: 403 }
        );
      }
    }

    const messageResult = await sql`
      INSERT INTO chat_messages (
        user_id,
        username,
        stream_session_id,
        content,
        message_type,
        created_at
      )
      VALUES (${sender_id}, ${sender_username}, ${session_id}, ${content}, ${messageType}, CURRENT_TIMESTAMP)
      RETURNING id, created_at
    `;

    const newMessage = messageResult.rows[0];

    await sql`
      UPDATE stream_sessions SET
        total_messages = total_messages + 1
      WHERE id = ${session_id}
    `;
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
    ).catch((e) => console.error("[chat] Realtime publish error:", e));

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

  // Kept as a second statement on purpose: with the session id bound as a
  // parameter the planner sees how busy this stream is and walks
  // idx_chat_messages_session_window backwards. Folded into one statement it
  // assumes an average-sized chat and sorts every message of a busy stream
  // (5x slower in scripts/load-test; see docs/postgres-pooling-and-chat-load.md).
  // The (created_at, id) row comparison becomes an index condition on
  // created_at, so a deep history page costs the same as the first one
  // (docs/database/query-performance.md).
  const sessionId = streamResult.rows[0].session_id;
  const bound = keysetBounds(page.after);
  const messagesResult = await sql<ChatRow>`
    SELECT
      cm.id,
      cm.content,
      cm.message_type,
      cm.created_at,
      to_char(cm.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts,
      u.username,
      u.wallet,
      u.avatar
    FROM chat_messages cm
    JOIN users u ON cm.user_id = u.id
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

    if (searchParams.has("before")) {
      return NextResponse.json(
        { error: "The before parameter was replaced by cursor" },
        { status: 400 }
      );
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
      if (streamerRow.rows.length > 0) {
        const streamerId: string = streamerRow.rows[0].id;
        // Record connection rate (leading indicator of load) without touching
        // the message-rate counter — GET is a read path.
        const connLevel = await recordConnectionRate(streamerId);
        // Read persisted spike level (written by POST handler on each message).
        const msgLevel = await getSpikeLevelForStream(streamerId);
        // Use the higher of the two levels.
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
        owner.mux_playback_id
      FROM chat_messages cm
      JOIN stream_sessions ss ON cm.stream_session_id = ss.id
      JOIN users owner ON owner.id = ss.user_id
      WHERE cm.id = ${messageId} AND cm.is_deleted = false
    `;

    if (messageResult.rows.length === 0) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const message = messageResult.rows[0];

    // Check permissions against verified session.userId
    const isOwner = session.userId === message.stream_owner_id;
    const isAuthor = session.userId === message.message_user_id;

    if (!isOwner && !isAuthor) {
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
