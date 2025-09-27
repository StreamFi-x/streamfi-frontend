import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { livepeerService } from "@/lib/streaming/livepeer-service";

/**
 * GET /api/v2/streaming/playback/stream/[streamId]
 * Get playback information for a specific stream ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ streamId: string }> }
) {
  try {
    const { streamId } = await params;

    if (!streamId) {
      return NextResponse.json(
        { error: "Stream ID is required" },
        { status: 400 }
      );
    }

    // Get stream information from database
    const userResult = await sql`
      SELECT 
        u.id,
        u.username,
        u.wallet,
        u.livepeer_stream_id_v2,
        u.playback_id_v2,
        u.is_live_v2,
        u.stream_started_at_v2,
        u.creator
      FROM users u
      WHERE u.livepeer_stream_id = ${streamId}
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    const user = userResult.rows[0];
    const creatorData = user.creator || {};

    // Get stream information from Livepeer
    let livepeerStream;
    try {
      livepeerStream = await livepeerService.getStream(streamId);
    } catch (streamError) {
      console.error("Failed to get stream from Livepeer:", streamError);
      return NextResponse.json(
        { error: "Stream not available" },
        { status: 503 }
      );
    }

    // Get playback information
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

    // Get stream health
    let streamHealth = null;
    try {
      streamHealth = await livepeerService.getStreamHealth(streamId);
    } catch (healthError) {
      console.warn("Failed to get stream health:", healthError);
    }

    return NextResponse.json({
      success: true,
      stream: {
        streamId: streamId,
        playbackId: user.playback_id_v2,
        isLive: user.is_live_v2,
        isActive: livepeerStream.isActive,
        startedAt: user.stream_started_at_v2,
        lastSeen: livepeerStream.lastSeen,
        title: creatorData.streamTitle || livepeerStream.name,
        description: creatorData.description || "",
        category: creatorData.category || "",
        tags: creatorData.tags || [],
        creator: {
          username: user.username,
          wallet: user.wallet,
        },
        playback: {
          hlsUrl: playbackInfo.hlsUrl,
          rtmpUrl: playbackInfo.rtmpUrl,
          dashUrl: playbackInfo.dashUrl,
        },
        health: streamHealth,
        livepeer: {
          name: livepeerStream.name,
          createdAt: livepeerStream.createdAt,
          isActive: livepeerStream.isActive,
          lastSeen: livepeerStream.lastSeen,
        },
      },
    });
  } catch (error) {
    console.error("Stream playback error:", error);
    return NextResponse.json(
      { error: "Failed to get stream playback information" },
      { status: 500 }
    );
  }
}
