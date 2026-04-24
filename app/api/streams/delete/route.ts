import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { deleteMuxStream } from "@/lib/mux/server";
import { routesFSuccess, routesFError } from "../../routesF/response";

export async function DELETE(req: Request) {
  try {
    const { wallet } = await req.json();

    if (!wallet) {
      return routesFError("Wallet is required", 400);
    }

    const userResult = await sql`
      SELECT id, username, mux_stream_id, is_live
      FROM users
      WHERE LOWER(wallet) = LOWER(${wallet})
    `;

    if (userResult.rows.length === 0) {
      return routesFError("User not found", 404);
    }

    const user = userResult.rows[0];

    if (!user.mux_stream_id) {
      return routesFError("No stream found to delete", 404);
    }

    if (user.is_live) {
      return routesFError(
        "Cannot delete stream while live. Please stop the stream first.",
        409
      );
    }

    // Delete Mux stream (best-effort, log but do not fail)
    try {
      await deleteMuxStream(user.mux_stream_id);
      console.log(`[routes-f] Mux stream deleted: ${user.mux_stream_id}`);
    } catch (muxError) {
      console.error("[routes-f] Mux deletion failed:", muxError);
    }

    // End any active stream sessions
    try {
      await sql`
        UPDATE stream_sessions
        SET ended_at = CURRENT_TIMESTAMP
        WHERE user_id = ${user.id} AND ended_at IS NULL
      `;
    } catch (sessionError) {
      console.error("[routes-f] Failed to end stream sessions:", sessionError);
    }

    // Clear user's stream fields
    await sql`
      UPDATE users
      SET
        mux_stream_id = NULL,
        mux_playback_id = NULL,
        streamkey = NULL,
        is_live = false,
        current_viewers = 0,
        stream_started_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${user.id}
    `;

    return routesFSuccess({ message: "Stream deleted successfully" }, 200);
  } catch (error) {
    console.error("[routes-f] Stream deletion error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return routesFError("Failed to delete stream", 500, { details: msg });
  }
}