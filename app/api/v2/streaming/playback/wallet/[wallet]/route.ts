import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { livepeerService } from "@/lib/streaming/livepeer-service";

/**
 * GET /api/v2/streaming/playback/wallet/[wallet]
 * Get playback information for a wallet address
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    // Get user's stream information
    const userResult = await sql`
      SELECT 
        id,
        username,
        livepeer_stream_id_v2,
        playback_id_v2,
        is_live_v2,
        stream_started_at_v2,
        creator
      FROM users 
      WHERE LOWER(wallet) = LOWER(${wallet})
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];
    const creatorData = user.creator || {};

    if (!user.livepeer_stream_id_v2 || !user.playback_id_v2) {
      return NextResponse.json(
        { error: "No stream found for this wallet" },
        { status: 404 }
      );
    }

    // Get playback information from Livepeer
    let playbackInfo;
    try {
      playbackInfo = await livepeerService.getPlaybackInfo(user.playback_id_v2);
    } catch (playbackError) {
      console.error("Failed to get playback info:", playbackError);
      return NextResponse.json(
        { error: "Stream playback unavailable" },
        { status: 503 }
      );
    }

    // Get stream health if stream is live
    let streamHealth = null;
    if (user.is_live_v2) {
      try {
        streamHealth = await livepeerService.getStreamHealth(
          user.livepeer_stream_id_v2
        );
      } catch (healthError) {
        console.warn("Failed to get stream health:", healthError);
      }
    }

    return NextResponse.json({
      success: true,
      stream: {
        streamId: user.livepeer_stream_id_v2,
        playbackId: user.playback_id,
        isLive: user.is_live_v2,
        viewerCount: user.current_viewers_v2 || 0,
        startedAt: user.stream_started_at_v2,
        title: creatorData.streamTitle || "",
        description: creatorData.description || "",
        category: creatorData.category || "",
        tags: creatorData.tags || [],
        creator: {
          username: user.username,
          wallet: wallet,
        },
        playbackInfo: playbackInfo,
        health: streamHealth,
      },
    });
  } catch (error) {
    console.error("Playback info error:", error);
    return NextResponse.json(
      { error: "Failed to get playback information" },
      { status: 500 }
    );
  }
}
