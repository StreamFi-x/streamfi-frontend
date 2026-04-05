import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";

// 30 messages per minute per IP prevents chat spam
const isRateLimited = createRateLimiter(60_000, 30);

function isValidStellarPublicKey(key: unknown): key is string {
  return typeof key === "string" && /^G[A-Z0-9]{55}$/.test(key);
}

function isGiftMetadata(metadata: unknown): metadata is {
  gift_name: string;
  gift_emoji: string;
  usd_value: string;
  tx_hash: string;
  animation?: string;
} {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }

  const candidate = metadata as Record<string, unknown>;
  return (
    typeof candidate.gift_name === "string" &&
    typeof candidate.gift_emoji === "string" &&
    typeof candidate.usd_value === "string" &&
    typeof candidate.tx_hash === "string"
  );
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
      metadata = null,
    } = await req.json();

    if (!wallet || !playbackId || !content) {
      return NextResponse.json(
        { error: "Wallet, playback ID, and content are required" },
        { status: 400 }
      );
    }

    if (!isValidStellarPublicKey(wallet)) {
      return NextResponse.json(
        { error: "Invalid Stellar public key" },
        { status: 400 }
      );
    }

    if (content.length > 500) {
      return NextResponse.json(
        { error: "Message must be 500 characters or less" },
        { status: 400 }
      );
    }

    if (!["message", "emote", "system", "gift"].includes(messageType)) {
      return NextResponse.json(
        { error: "Invalid message type" },
        { status: 400 }
      );
    }

    if (messageType === "gift" && !isGiftMetadata(metadata)) {
      return NextResponse.json(
        { error: "Gift messages require gift metadata" },
        { status: 400 }
      );
    }

    // Combined query: look up sender + stream + active session + moderation settings in one round-trip
    const result = await sql`
      SELECT
        sender.id AS sender_id,
        sender.username AS sender_username,
        streamer.id AS streamer_id,
        streamer.username AS streamer_username,
        streamer.is_live,
        streamer.slow_mode_seconds,
        streamer.follower_only_chat,
        streamer.link_blocking,
        (
          SELECT ss.id FROM stream_sessions ss
          WHERE ss.user_id = streamer.id AND ss.ended_at IS NULL
          ORDER BY ss.started_at DESC LIMIT 1
        ) AS session_id
      FROM users sender
      CROSS JOIN users streamer
      WHERE sender.wallet = ${wallet}
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
      streamer_username,
      is_live,
      session_id,
      slow_mode_seconds,
      follower_only_chat,
      link_blocking,
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

    // 1. Check for permanent ban
    const permanentBanResult = await sql`
      SELECT id FROM chat_bans
      WHERE stream_owner = ${streamer_username}
        AND banned_user = ${sender_username}
        AND expires_at IS NULL
    `;

    if (permanentBanResult.rows.length > 0) {
      return NextResponse.json(
        { error: "You are banned from this chat" },
        { status: 403 }
      );
    }

    // 2. Check for active timeout
    const timeoutResult = await sql`
      SELECT expires_at FROM chat_bans
      WHERE stream_owner = ${streamer_username}
        AND banned_user = ${sender_username}
        AND expires_at IS NOT NULL
        AND expires_at > now()
    `;

    if (timeoutResult.rows.length > 0) {
      const expiresAt = new Date(timeoutResult.rows[0].expires_at);
      const now = new Date();
      const secondsRemaining = Math.ceil(
        (expiresAt.getTime() - now.getTime()) / 1000
      );

      return NextResponse.json(
        {
          error: `You are timed out for ${Math.ceil(secondsRemaining / 60)} minute(s)`,
        },
        {
          status: 429,
          headers: { "Retry-After": secondsRemaining.toString() },
        }
      );
    }

    // 3. Check slow mode
    if (slow_mode_seconds > 0) {
      const lastMessageResult = await sql`
        SELECT created_at FROM chat_messages
        WHERE stream_session_id = ${session_id}
          AND user_id = ${sender_id}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (lastMessageResult.rows.length > 0) {
        const lastMessageTime = new Date(lastMessageResult.rows[0].created_at);
        const now = new Date();
        const secondsSinceLastMessage =
          (now.getTime() - lastMessageTime.getTime()) / 1000;

        if (secondsSinceLastMessage < slow_mode_seconds) {
          const waitSeconds = Math.ceil(
            slow_mode_seconds - secondsSinceLastMessage
          );
          return NextResponse.json(
            { error: `Slow mode is enabled. Wait ${waitSeconds} second(s)` },
            {
              status: 429,
              headers: { "Retry-After": waitSeconds.toString() },
            }
          );
        }
      }
    }

    // 4. Check follower-only mode
    if (follower_only_chat) {
      const followerResult = await sql`
        SELECT id FROM users
        WHERE username = ${sender_username}
          AND ${streamer_username} = ANY(following)
      `;

      if (followerResult.rows.length === 0) {
        return NextResponse.json(
          { error: "This chat is in follower-only mode" },
          { status: 403 }
        );
      }
    }

    // 5. Check link blocking
    if (link_blocking) {
      const urlRegex =
        /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|io|dev|gg|tv|me|co)[^\s]*)/gi;
      if (urlRegex.test(content)) {
        return NextResponse.json(
          { error: "Links are not allowed in this chat" },
          { status: 400 }
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
        metadata,
        created_at
      )
      VALUES (${sender_id}, ${sender_username}, ${session_id}, ${content}, ${messageType}, ${metadata}, CURRENT_TIMESTAMP)
      RETURNING id, created_at, metadata
    `;

    const newMessage = messageResult.rows[0];

    await sql`
      UPDATE stream_sessions SET
        total_messages = total_messages + 1
      WHERE id = ${session_id}
    `;

    return NextResponse.json(
      {
        message: "Message sent successfully",
        chatMessage: {
          id: newMessage.id,
          content,
          messageType,
          metadata: newMessage.metadata,
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const playbackId = searchParams.get("playbackId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const before = searchParams.get("before");

    if (!playbackId) {
      return NextResponse.json(
        { error: "Playback ID is required" },
        { status: 400 }
      );
    }

    const streamResult = await sql`
      SELECT ss.id as session_id
      FROM users u
      JOIN stream_sessions ss ON u.id = ss.user_id AND ss.ended_at IS NULL
      WHERE u.mux_playback_id = ${playbackId}
      ORDER BY ss.started_at DESC
      LIMIT 1
    `;

    if (streamResult.rows.length === 0) {
      return NextResponse.json({ messages: [] }, { status: 200 });
    }

    const sessionId = streamResult.rows[0].session_id;

    // Single query handles both cursor-based and initial fetch
    const beforeId = before ? parseInt(before) : null;
    const messagesResult = await sql`
      SELECT
        cm.id,
        cm.content,
        cm.message_type,
        cm.metadata,
        cm.created_at,
        u.username,
        u.wallet,
        u.avatar
      FROM chat_messages cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.stream_session_id = ${sessionId}
        AND cm.is_deleted = false
        AND (${beforeId}::int IS NULL OR cm.id < ${beforeId})
      ORDER BY cm.created_at DESC
      LIMIT ${limit}
    `;

    const messages = messagesResult.rows.map(msg => ({
      id: msg.id,
      content: msg.content,
      messageType: msg.message_type,
      metadata: msg.metadata,
      createdAt: msg.created_at,
      user: {
        username: msg.username,
        wallet: msg.wallet,
        avatar: msg.avatar,
      },
    }));

    return NextResponse.json({ messages: messages.reverse() }, { status: 200 });
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

    if (!isValidStellarPublicKey(moderatorWallet)) {
      return NextResponse.json(
        { error: "Invalid Stellar public key" },
        { status: 400 }
      );
    }

    const moderatorResult = await sql`
      SELECT id FROM users WHERE wallet = ${moderatorWallet}
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
        ss.user_id as stream_owner_id
      FROM chat_messages cm
      JOIN stream_sessions ss ON cm.stream_session_id = ss.id
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
