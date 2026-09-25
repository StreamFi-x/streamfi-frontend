import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";
import { CACHE_POLICIES, cacheHeaders } from "@/lib/cache";
import { createCache, createMemoryBackend } from "@/lib/cache/store";

// 30 messages per minute per IP prevents chat spam
const isRateLimited = createRateLimiter(60_000, 30);

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

// Every viewer of a stream polls the same window once a second. The edge
// (chatWindow policy) collapses those per region; this per-instance cache
// collapses whatever reaches one instance into one query per second per
// stream. It is deliberately not Redis: at one command per poll the Redis bill
// would scale with viewers, which is the cost we are trying to remove.
// docs/postgres-pooling-and-chat-load.md has the measurements.
const chatWindowCache = createCache(createMemoryBackend());
const chatTag = (playbackId: string) => `chat:${playbackId}`;

function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  try {
    const {
      wallet,
      playbackId,
      content,
      messageType = "message",
    } = await req.json();

    if (!wallet || !playbackId || !content) {
      return NextResponse.json(
        { error: "Wallet, playback ID, and content are required" },
        { status: 400 }
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

    // Combined query: look up sender + stream + active session in one round-trip
    const result = await sql`
      SELECT
        sender.id AS sender_id,
        sender.username AS sender_username,
        streamer.id AS streamer_id,
        streamer.is_live,
        (
          SELECT ss.id FROM stream_sessions ss
          WHERE ss.user_id = streamer.id AND ss.ended_at IS NULL
          ORDER BY ss.started_at DESC LIMIT 1
        ) AS session_id
      FROM users sender
      CROSS JOIN users streamer
      WHERE sender.wallet = ${wallet}
        AND streamer.mux_playback_id = ${playbackId}
        AND sender.deleted_at IS NULL
        AND streamer.deleted_at IS NULL
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "User or stream not found" },
        { status: 404 }
      );
    }

    const { sender_id, sender_username, is_live, session_id } = result.rows[0];

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

    return NextResponse.json(
      {
        message: "Message sent successfully",
        chatMessage: {
          id: newMessage.id,
          content,
          messageType,
          user: {
            username: sender_username,
            wallet: wallet,
          },
          createdAt: newMessage.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Chat message error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

async function loadChatWindow(
  playbackId: string,
  limit: number,
  beforeId: number | null
) {
  const streamResult = await sql`
    SELECT ss.id as session_id
    FROM users u
    JOIN stream_sessions ss ON u.id = ss.user_id AND ss.ended_at IS NULL
    WHERE u.mux_playback_id = ${playbackId} AND u.deleted_at IS NULL
    ORDER BY ss.started_at DESC
    LIMIT 1
  `;

  if (streamResult.rows.length === 0) {
    return [];
  }

  // Kept as a second statement on purpose: with the session id bound as a
  // parameter the planner sees how busy this stream is and walks
  // idx_chat_messages_session_window backwards. Folded into one statement it
  // assumes an average-sized chat and sorts every message of a busy stream
  // (5x slower in scripts/load-test; see docs/postgres-pooling-and-chat-load.md).
  const sessionId = streamResult.rows[0].session_id;
  const messagesResult = await sql`
    SELECT
      cm.id,
      cm.content,
      cm.message_type,
      cm.created_at,
      u.username,
      u.wallet,
      u.avatar
    FROM chat_messages cm
    JOIN users u ON cm.user_id = u.id AND u.deleted_at IS NULL
    WHERE cm.stream_session_id = ${sessionId}
      AND cm.is_deleted = false
      AND (${beforeId}::int IS NULL OR cm.id < ${beforeId})
    ORDER BY cm.created_at DESC
    LIMIT ${limit}
  `;

  return messagesResult.rows
    .map(msg => ({
      id: msg.id,
      content: msg.content,
      messageType: msg.message_type,
      createdAt: msg.created_at,
      user: {
        username: msg.username,
        wallet: msg.wallet,
        avatar: msg.avatar,
      },
    }))
    .reverse();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const playbackId = searchParams.get("playbackId");
    const limit = parseLimit(searchParams.get("limit"));
    const before = searchParams.get("before");

    if (!playbackId) {
      return NextResponse.json(
        { error: "Playback ID is required" },
        { status: 400 }
      );
    }

    const beforeId = before ? parseInt(before) : null;
    const messages = await chatWindowCache.getOrLoad(
      {
        key: `chat:${playbackId}:${limit}:${beforeId ?? "live"}`,
        tags: [chatTag(playbackId)],
        ttlSeconds: CACHE_POLICIES.chatWindow.appTtlSeconds,
      },
      () => loadChatWindow(playbackId, limit, beforeId)
    );

    return NextResponse.json(
      { messages },
      { status: 200, headers: cacheHeaders("chatWindow") }
    );
  } catch (error) {
    console.error("Get chat messages error:", error);
    return NextResponse.json(
      { error: "Failed to get messages" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { messageId, moderatorWallet } = await req.json();

    if (!messageId || !moderatorWallet) {
      return NextResponse.json(
        { error: "Message ID and moderator wallet are required" },
        { status: 400 }
      );
    }

    const moderatorResult = await sql`
      SELECT id FROM users WHERE wallet = ${moderatorWallet} AND deleted_at IS NULL
    `;

    if (moderatorResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Moderator not found" },
        { status: 404 }
      );
    }

    const moderatorId = moderatorResult.rows[0].id;

    const messageResult = await sql`
      SELECT 
        cm.id,
        cm.user_id as message_user_id,
        ss.user_id as stream_owner_id,
        owner.mux_playback_id
      FROM chat_messages cm
      JOIN stream_sessions ss ON cm.stream_session_id = ss.id
      -- tombstone-aware: moderation of a stored message, whatever the owner's state
      JOIN users owner ON owner.id = ss.user_id
      WHERE cm.id = ${messageId} AND cm.is_deleted = false
    `;

    if (messageResult.rows.length === 0) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const message = messageResult.rows[0];

    if (
      moderatorId !== message.stream_owner_id &&
      moderatorId !== message.message_user_id
    ) {
      return NextResponse.json(
        { error: "Insufficient permissions to delete this message" },
        { status: 403 }
      );
    }

    await sql`
      UPDATE chat_messages SET
        is_deleted = true,
        is_moderated = true,
        moderated_by = ${moderatorId}
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
