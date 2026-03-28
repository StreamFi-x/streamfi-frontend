import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureRoutesFSchema } from "../../_lib/schema";

/**
 * DELETE /api/routes-f/comments/[id] — remove own comment or creator-delete any comment on their recording.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureRoutesFSchema();
    const session = await verifySession(req);
    if (!session.ok) return session.response;

    const { id } = await params;

    // Fetch comment and associated recording creator
    const { rows } = await sql`
      SELECT c.user_id, c.recording_id, r.user_id as creator_id
      FROM vod_comments c
      LEFT JOIN stream_recordings r ON (c.recording_id = r.id::text OR c.recording_id = r.playback_id)
      WHERE c.id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const comment = rows[0];

    // Authorized if either user is the comment author OR user is the recording creator
    const isAuthor = session.userId === comment.user_id;
    const isCreator = session.userId === comment.creator_id;

    if (!isAuthor && !isCreator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await sql`DELETE FROM vod_comments WHERE id = ${id}`;

    return NextResponse.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Comment DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
