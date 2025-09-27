import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import {
  authenticateWalletSimple,
  getUserStreamInfo,
} from "@/lib/streaming/auth-utils";
import { livepeerService } from "@/lib/streaming/livepeer-service";

/**
 * POST /api/v2/streaming/streams/terminate
 * Terminate stream for authenticated wallet (stops stream but keeps it for later use)
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate wallet
    const authResult = await authenticateWalletSimple(request);
    if (!authResult.isValid) {
      return NextResponse.json(
        { error: authResult.error || "Authentication failed" },
        { status: 401 }
      );
    }

    // Get user's stream information
    const streamInfo = await getUserStreamInfo(authResult.walletAddress);

    if (!streamInfo.hasStream) {
      return NextResponse.json({ error: "No stream found" }, { status: 404 });
    }

    if (!streamInfo.isLive) {
      return NextResponse.json(
        { error: "Stream is not currently live" },
        { status: 409 }
      );
    }

    // Terminate stream with Livepeer
    if (streamInfo.streamId) {
      try {
        await livepeerService.terminateStream(streamInfo.streamId);
        console.log(
          "Livepeer stream terminated successfully:",
          streamInfo.streamId
        );
      } catch (livepeerError) {
        console.error("Failed to terminate Livepeer stream:", livepeerError);
        // Continue with database update even if Livepeer termination fails
      }
    }

    // Update user record to mark stream as not live
    const result = await sql`
      UPDATE users SET
        is_live_v2 = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE LOWER(wallet) = LOWER(${authResult.walletAddress})
      RETURNING id, username, livepeer_stream_id_v2, stream_started_at_v2
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Failed to update stream status" },
        { status: 500 }
      );
    }

    const updatedUser = result.rows[0];

    // Update stream session to mark as ended
    try {
      await sql`
        UPDATE stream_sessions_v2 
        SET ended_at = CURRENT_TIMESTAMP
        WHERE user_id = ${updatedUser.id} AND livepeer_stream_id = ${updatedUser.livepeer_stream_id_v2}
      `;
    } catch (sessionError) {
      console.error("Failed to update stream session:", sessionError);
      // Continue - this is not critical
    }

    return NextResponse.json({
      success: true,
      message: "Stream terminated successfully",
      stream: {
        streamId: streamInfo.streamId,
        playbackId: streamInfo.playbackId,
        isLive: false,
        terminatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Stream termination error:", error);
    return NextResponse.json(
      { error: "Failed to terminate stream" },
      { status: 500 }
    );
  }
}
