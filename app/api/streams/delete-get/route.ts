/**
 * app/api/streams/force-delete/route.ts
 * 
 * Force delete stream (stops first, then deletes)
 * DELETE THIS FILE AFTER TESTING
 */

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { deleteLivepeerStream } from "@/lib/livepeer/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet parameter required" },
        { status: 400 }
      );
    }

    console.log(`🔧 Force deleting stream for wallet: ${wallet}`);

    // Get user and stream data
    const userResult = await sql`
      SELECT id, username, livepeer_stream_id, is_live
      FROM users 
      WHERE LOWER(wallet) = LOWER(${wallet})
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    if (!user.livepeer_stream_id) {
      return NextResponse.json(
        { message: "No stream found to delete" },
        { status: 200 }
      );
    }

    // Step 1: Force stop stream if live
    if (user.is_live) {
      console.log('⏹️ Stopping live stream first...');
      await sql`
        UPDATE users SET
          is_live = false,
          stream_started_at = NULL,
          current_viewers = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${user.id}
      `;

      // End current stream session
      try {
        await sql`
          UPDATE stream_sessions SET
            ended_at = CURRENT_TIMESTAMP
          WHERE user_id = ${user.id} AND ended_at IS NULL
        `;
      } catch (sessionError) {
        console.error("Failed to end stream session:", sessionError);
      }
    }

    // Step 2: Delete from Livepeer
    console.log('🗑️ Deleting from Livepeer...');
    try {
      await deleteLivepeerStream(user.livepeer_stream_id);
    } catch (livepeerError) {
      console.error("Livepeer deletion failed:", livepeerError);
      // Continue with database cleanup even if Livepeer deletion fails
    }

    // Step 3: Clear all stream data from database
    console.log('🧹 Cleaning up database...');
    await sql`
      UPDATE users SET
        livepeer_stream_id = NULL,
        playback_id = NULL,
        streamkey = NULL,
        is_live = false,
        current_viewers = 0,
        stream_started_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE LOWER(wallet) = LOWER(${wallet})
    `;

    console.log('✅ Force delete completed!');

    return NextResponse.json(
      { 
        message: "Stream force deleted successfully (stopped and removed)",
        actions: [
          user.is_live ? "Stopped live stream" : "Stream was already stopped",
          "Deleted from Livepeer",
          "Cleaned database records"
        ],
        wallet: wallet
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Force delete error:", error);
    return NextResponse.json(
      { error: "Failed to force delete stream" },
      { status: 500 }
    );
  }
}