import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";
import { verifySession } from "@/lib/auth/verify-session";

// 30 messages per minute per IP prevents chat spam
const isRateLimited = createRateLimiter(60_000, 30);

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

  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      wallet,
      playbackId,
      content,
      messageType = "message",
    } = body;

    if (!playbackId || !content) {
      return NextResponse.json(
        { error: "Playback ID and content are required" },
        { status: 400 }
      );
    }

    // Prevent wallet spoofing: verify body wallet matches authenticated session
    if (wallet && session.wallet && session.wallet.toLowerCase() !== wallet.toLowerCase()) {
      return NextResponse.json(
        { error: "Forbidden: wallet does not match authenticated session" },
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

    // Combined query: look up sender + stream + active session in one round-trip
    // Acting sender identity is derived from verified session (session.userId)
    const result = await sql`
      SELECT
        sender.id AS sender_id,
        sender.username AS sender_username,
        sender.wallet AS sender_wallet,
        streamer.id AS streamer_id,
        streamer.is_live,
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

    const { sender_id, sender_username, sender_wallet, is_live, session_id } = result.rows[0];

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

    const userWallet = sender_wallet || session.wallet || wallet;

    return NextResponse.json(
      {
        message: "Message sent successfully",
        chatMessage: {
          id: newMessage.id,
          content,
          messageType,
          user: {
            username: sender_username,
            wallet: userWallet,
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

export async function DELETE(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { messageId, moderatorWallet } = body;

    if (!messageId) {
      return NextResponse.json(
        { error: "Message ID is required" },
        { status: 400 }
      );
    }

    if (moderatorWallet && session.wallet && session.wallet.toLowerCase() !== moderatorWallet.toLowerCase()) {
      return NextResponse.json(
        { error: "Forbidden: moderator wallet does not match authenticated session" },
        { status: 403 }
      );
    }

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

    // Check if acting user is stream owner or message author
    let isAllowed =
      String(session.userId) === String(message.stream_owner_id) ||
      String(session.userId) === String(message.message_user_id);

    // If neither, verify moderator status in DB
    if (!isAllowed) {
      const userCheck = await sql`
        SELECT role, is_moderator FROM users WHERE id = ${session.userId}
      `;
      if (userCheck.rows.length > 0) {
        const u = userCheck.rows[0];
        if (u.is_moderator || u.role === "admin" || u.role === "moderator") {
          isAllowed = true;
        }
      }
    }

    if (!isAllowed) {
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
