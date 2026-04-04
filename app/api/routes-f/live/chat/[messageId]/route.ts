import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

// ── DELETE /api/routes-f/live/chat/[messageId] ────────────────────────────────
// Soft-deletes a chat message. Caller must be the stream owner or a moderator
// (currently: stream owner only — moderator table can extend this later).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { messageId: rawMessageId } = await params;
  const messageId = parseInt(rawMessageId, 10);
  if (isNaN(messageId)) {
    return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });
  }

  try {
    // Fetch message + stream owner in one query
    const result = await sql`
      SELECT
        cm.id,
        cm.is_deleted,
        ss.user_id AS stream_owner_id
      FROM chat_messages cm
      JOIN stream_sessions ss ON cm.stream_session_id = ss.id
      WHERE cm.id = ${messageId}
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const msg = result.rows[0];

    if (msg.is_deleted) {
      return NextResponse.json(
        { error: "Message already deleted" },
        { status: 409 }
      );
    }

    // Only stream owner (or the message author themselves) may delete
    if (session.userId !== msg.stream_owner_id) {
      // Allow self-delete
      const authorCheck = await sql`
        SELECT user_id FROM chat_messages WHERE id = ${messageId} LIMIT 1
      `;
      if (authorCheck.rows[0]?.user_id !== session.userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    await sql`
      UPDATE chat_messages SET
        is_deleted   = true,
        is_moderated = true,
        moderated_by = ${session.userId}
      WHERE id = ${messageId}
    `;

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[chat:DELETE] error:", error);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
