import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { deleteMuxStream } from "@/lib/mux/server";

export async function DELETE(req: Request) {
  try {
    const { wallet } = await req.json();

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet is required" },
        { status: 400 }
      );
    }

    const userResult = await sql`
      SELECT id, username, mux_stream_id, is_live
      FROM users
      WHERE wallet = ${wallet}
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
          error:
            "Cannot delete stream while live. Please stop the stream first.",
        },
        { status: 409 }
      );
    }

    try {
      await deleteMuxStream(user.mux_stream_id);
    } catch (muxError) {
      console.error("Mux deletion failed:", muxError);
      // Continue even if Mux deletion fails
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
      WHERE wallet = ${wallet}
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
