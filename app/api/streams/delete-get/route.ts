import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { deleteMuxStream } from "@/lib/mux/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet parameter is required" },
        { status: 400 }
      );
    }

    console.log(`[routes-f] Force delete stream requested for wallet: ${wallet}`);

    // Fetch user
    const userResult = await sql`
      SELECT id, username, mux_stream_id, is_live
      FROM users
      WHERE LOWER(wallet) = LOWER(${wallet})
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];

    if (!user.mux_stream_id) {
      return NextResponse.json(
        { message: "No stream found to delete", wallet },
        { status: 200 }
      );
    }

    const actions: string[] = [];

    // Stop live stream if active
    if (user.is_live) {
      console.log(`[routes-f] Stopping live stream for wallet: ${wallet}`);
      await sql`
        UPDATE users SET
          is_live = false,
          stream_started_at = NULL,
          current_viewers = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${user.id}
      `;
      actions.push("Stopped live stream");

      try {
        await sql`
          UPDATE stream_sessions
          SET ended_at = CURRENT_TIMESTAMP
          WHERE user_id = ${user.id} AND ended_at IS NULL
        `;
      } catch (sessionError) {
        console.error("[routes-f] Failed to end active stream session:", sessionError);
      }
    } else {
      actions.push("Stream was already stopped");
    }

    // Delete Mux stream (best-effort)
    try {
      console.log(`[routes-f] Deleting Mux stream: ${user.mux_stream_id}`);
      await deleteMuxStream(user.mux_stream_id);
      actions.push("Deleted from Mux");
    } catch (muxError) {
      console.error("[routes-f] Mux deletion failed:", muxError);
    }

    // Clear user's stream fields
    await sql`
      UPDATE users SET
        mux_stream_id = NULL,
        mux_playback_id = NULL,
        streamkey = NULL,
        is_live = false,
        current_viewers = 0,
        stream_started_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${user.id}
    `;
    actions.push("Cleaned database records");

    console.log(`[routes-f] Force delete completed for wallet: ${wallet}`);

    return NextResponse.json(
      {
        message: "Stream force deleted successfully",
        actions,
        wallet,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[routes-f] Force delete error:", error);
    return NextResponse.json(
      { error: "Failed to force delete stream" },
      { status: 500 }
    );
  }
}