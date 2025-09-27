import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import {
  authenticateWalletSimple,
  getUserStreamInfo,
} from "@/lib/streaming/auth-utils";
import { livepeerService } from "@/lib/streaming/livepeer-service";

/**
 * GET /api/v2/streaming/streams/status
 * Get stream status for authenticated wallet
 */
export async function GET(request: NextRequest) {
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
      return NextResponse.json({
        success: true,
        hasStream: false,
        message: "No stream found",
      });
    }

    // Get additional stream data from database
    const userResult = await sql`
      SELECT 
        livepeer_stream_id_v2,
        playback_id_v2,
        streamkey,
        is_live_v2,
        stream_started_at_v2,
        creator
      FROM users 
      WHERE LOWER(wallet) = LOWER(${authResult.walletAddress})
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];
    const creatorData = user.creator || {};

    // Get stream health from Livepeer if stream is active
    let streamHealth = null;
    if (streamInfo.streamId && streamInfo.isLive) {
      try {
        streamHealth = await livepeerService.getStreamHealth(
          streamInfo.streamId
        );
      } catch (healthError) {
        console.warn("Failed to get stream health:", healthError);
      }
    }

    return NextResponse.json({
      success: true,
      hasStream: true,
      stream: {
        streamId: streamInfo.streamId,
        playbackId: streamInfo.playbackId,
        streamKey: streamInfo.streamKey,
        isLive: streamInfo.isLive,
        viewerCount: user.current_viewers_v2 || 0,
        startedAt: user.stream_started_at_v2,
        title: creatorData.streamTitle || "",
        description: creatorData.description || "",
        category: creatorData.category || "",
        tags: creatorData.tags || [],
        health: streamHealth,
      },
    });
  } catch (error) {
    console.error("Stream status error:", error);
    return NextResponse.json(
      { error: "Failed to get stream status" },
      { status: 500 }
    );
  }
}
