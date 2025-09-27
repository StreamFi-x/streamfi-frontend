import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import {
  authenticateWalletSimple,
  getUserStreamInfo,
} from "@/lib/streaming/auth-utils";
import { livepeerService } from "@/lib/streaming/livepeer-service";

/**
 * POST /api/v2/streaming/streams/start
 * Start streaming for authenticated wallet
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
      return NextResponse.json(
        { error: "No stream found. Please create a stream first." },
        { status: 404 }
      );
    }

    if (streamInfo.isLive) {
      return NextResponse.json(
        { error: "Stream is already live" },
        { status: 409 }
      );
    }

    if (!streamInfo.streamId) {
      return NextResponse.json(
        { error: "Invalid stream configuration" },
        { status: 400 }
      );
    }

    // Check stream health with Livepeer
    try {
      const health = await livepeerService.getStreamHealth(streamInfo.streamId);
      console.log("Stream health check:", health);
    } catch (healthError) {
      console.warn("Stream health check failed:", healthError);
      // Continue anyway - the stream might not be active yet
    }

    // Update user record to mark stream as live
    const result = await sql`
      UPDATE users SET
        is_live_v2 = true,
        stream_started_at_v2 = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE LOWER(wallet) = LOWER(${authResult.walletAddress})
      RETURNING id, username, livepeer_stream_id_v2, playback_id_v2
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Failed to update stream status" },
        { status: 500 }
      );
    }

    const updatedUser = result.rows[0];

    // Update stream session
    try {
      await sql`
        UPDATE stream_sessions_v2 
        SET started_at = CURRENT_TIMESTAMP
        WHERE user_id = ${updatedUser.id} AND livepeer_stream_id = ${updatedUser.livepeer_stream_id_v2}
      `;
    } catch (sessionError) {
      console.error("Failed to update stream session:", sessionError);
      // Continue - this is not critical
    }

    return NextResponse.json({
      success: true,
      message: "Stream started successfully",
      stream: {
        streamId: streamInfo.streamId,
        playbackId: streamInfo.playbackId,
        streamKey: streamInfo.streamKey,
        isLive: true,
        startedAt: new Date().toISOString(),
        viewerCount: 0,
      },
    });
  } catch (error) {
    console.error("Stream start error:", error);
    return NextResponse.json(
      { error: "Failed to start stream" },
      { status: 500 }
    );
  }
}
