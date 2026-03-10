import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { deleteMuxStream } from "@/lib/mux/server";
import { verifySession } from "@/lib/auth/verify-session";

export async function DELETE(req: NextRequest) {
  // Verify caller is authenticated — identity comes from the server-side session
  // cookie, NOT from client-supplied body fields.
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  try {
    const userResult = await sql`
      SELECT id, username, mux_stream_id, is_live
      FROM users
      WHERE id = ${session.userId}
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];

    if (!user.mux_stream_id) {
      return NextResponse.json(
        { error: "No stream found to delete" },
        { status: 404 }
      );
    }

    if (user.is_live) {
      return NextResponse.json(
        {
          error: "Cannot delete stream while live. Please stop the stream first.",
        },
        { status: 409 }
      );
    }

    try {
      await deleteMuxStream(user.mux_stream_id);
    } catch (muxError) {
      console.error("Mux deletion failed:", muxError);
      // Continue even if Mux deletion fails — we still clean up our DB record
    }

    try {
      await sql`
        UPDATE stream_sessions SET
          ended_at = CURRENT_TIMESTAMP
        WHERE user_id = ${user.id} AND ended_at IS NULL
      `;
    } catch (sessionError) {
      console.error("Failed to end stream sessions:", sessionError);
    }

    await sql`
      UPDATE users SET
        mux_stream_id = NULL,
        mux_playback_id = NULL,
        streamkey = NULL,
        is_live = false,
        current_viewers = 0,
        stream_started_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${session.userId}
    `;

    return NextResponse.json(
      { message: "Stream deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Stream deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete stream" },
      { status: 500 }
    );
  }
}
