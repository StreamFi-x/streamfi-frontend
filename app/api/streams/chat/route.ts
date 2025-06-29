
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function POST(req: Request) {
  try {
    const { wallet, playbackId, content, messageType = 'message' } = await req.json();

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

    if (!['message', 'emote', 'system'].includes(messageType)) {
      return NextResponse.json(
        { error: "Invalid message type" },
        { status: 400 }
      );
    }

    
    const userResult = await sql`
      SELECT id, username FROM users WHERE wallet = ${wallet}
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    
    const streamResult = await sql`
      SELECT u.id as stream_user_id, u.username as stream_username, u.is_live,
             ss.id as session_id
      FROM users u
      LEFT JOIN stream_sessions ss ON u.id = ss.user_id AND ss.ended_at IS NULL
      WHERE u.playback_id = ${playbackId}
    `;

    if (streamResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Stream not found" },
        { status: 404 }
      );
    }

    const stream = streamResult.rows[0];

    if (!stream.is_live) {
      return NextResponse.json(
        { error: "Cannot send message to offline stream" },
        { status: 409 }
      );
    }

    if (!stream.session_id) {
      return NextResponse.json(
        { error: "No active stream session" },
        { status: 404 }
      );
    }

    
    const messageResult = await sql`
      INSERT INTO chat_messages (
        user_id,
        stream_session_id,
        content,
        message_type,
        created_at
      )
      VALUES (${user.id}, ${stream.session_id}, ${content}, ${messageType}, CURRENT_TIMESTAMP)
      RETURNING id, created_at
    `;

    const newMessage = messageResult.rows[0];

    
    await sql`
      UPDATE stream_sessions SET
        total_messages = total_messages + 1
      WHERE id = ${stream.session_id}
    `;

    return NextResponse.json(
      {
        message: "Message sent successfully",
        chatMessage: {
          id: newMessage.id,
          content,
          messageType,
          user: {
            username: user.username,
            wallet: wallet,
          },
          createdAt: newMessage.created_at,
        }
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
    const playbackId = searchParams.get('playbackId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); 

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
      WHERE u.playback_id = ${playbackId}
    `;

    if (streamResult.rows.length === 0) {
      return NextResponse.json(
        { messages: [] },
        { status: 200 }
      );
    }

    const sessionId = streamResult.rows[0].session_id;

    
    let query;
    if (before) {
      query = sql`
        SELECT 
          cm.id,
          cm.content,
          cm.message_type,
          cm.created_at,
          cm.is_deleted,
          u.username,
          u.wallet,
          u.avatar
        FROM chat_messages cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.stream_session_id = ${sessionId}
        AND cm.id < ${before}
        AND cm.is_deleted = false
        ORDER BY cm.created_at DESC
        LIMIT ${limit}
      `;
    } else {
      query = sql`
        SELECT 
          cm.id,
          cm.content,
          cm.message_type,
          cm.created_at,
          cm.is_deleted,
          u.username,
          u.wallet,
          u.avatar
        FROM chat_messages cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.stream_session_id = ${sessionId}
        AND cm.is_deleted = false
        ORDER BY cm.created_at DESC
        LIMIT ${limit}
      `;
    }

    const messagesResult = await query;

    const messages = messagesResult.rows.map(msg => ({
      id: msg.id,
      content: msg.content,
      messageType: msg.message_type,
      createdAt: msg.created_at,
      user: {
        username: msg.username,
        wallet: msg.wallet,
        avatar: msg.avatar,
      }
    }));

    return NextResponse.json(
      { messages: messages.reverse() },
      { status: 200 }
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
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    const message = messageResult.rows[0];

    
    if (moderatorId !== message.stream_owner_id && moderatorId !== message.message_user_id) {
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