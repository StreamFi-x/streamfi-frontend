import { NextResponse } from "next/server";
import { getPlaybackSource } from "@/lib/livepeer/server";
import { sql } from "@vercel/postgres";

export async function GET(
  req: Request,
  { params }: { params: { playbackId: string } },
) {
  try {
    const { playbackId } = params;

    console.log("🎬 Playback request for:", playbackId);

    if (!playbackId) {
      return NextResponse.json(
        { error: "Playback ID is required" },
        { status: 400 },
      );
    }

    if (playbackId.length < 10 || playbackId.length > 50) {
      console.log("❌ Invalid playback ID format:", playbackId);
      return NextResponse.json(
        { error: "Invalid playback ID format" },
        { status: 400 },
      );
    }

    let streamInfo = null;

    try {
      console.log("🔍 Checking database for playback ID...");
      const streamCheck = await sql`
        SELECT id, username, is_live, creator, current_viewers, total_views
        FROM users
        WHERE playback_id = ${playbackId}
      `;

      if (streamCheck.rows.length > 0) {
        const row = streamCheck.rows[0];
        streamInfo = {
          username: row.username,
          isLive: row.is_live,
          currentViewers: row.current_viewers || 0,
          totalViews: row.total_views || 0,
          title: row.creator?.streamTitle || "Live Stream",
          category: row.creator?.category || "General",
          tags: row.creator?.tags || [],
        };
        console.log("✅ Stream info found:", streamInfo);
      } else {
        console.log("⚠️ No stream info found in database for:", playbackId);
      }
    } catch (dbError) {
      console.error("Database check failed:", dbError);
    }

    console.log("🎬 Getting playback source from Livepeer...");
    let playbackSrc;

    try {
      playbackSrc = await getPlaybackSource(playbackId);
      console.log("✅ Playback source retrieved:", playbackSrc);
    } catch (livepeerError) {
      console.error("❌ Livepeer playback error:", livepeerError);

      if (livepeerError instanceof Error) {
        if (
          livepeerError.message.includes("404") ||
          livepeerError.message.includes("not found")
        ) {
          return NextResponse.json(
            {
              error: "Stream not found",
              details: "This stream may not exist or has been deleted",
              playbackId: playbackId,
            },
            { status: 404 },
          );
        }

        if (
          livepeerError.message.includes("unauthorized") ||
          livepeerError.message.includes("401")
        ) {
          return NextResponse.json(
            {
              error: "Unauthorized access",
              details: "Invalid API key or permissions",
            },
            { status: 401 },
          );
        }
      }

      console.log("⚠️ Livepeer API failed, providing fallback URLs");
      playbackSrc = {
        hls: `https://livepeercdn.studio/hls/${playbackId}/index.m3u8`,
        webrtc: `https://livepeercdn.studio/webrtc/${playbackId}`,
        thumbnail: `https://livepeercdn.studio/hls/${playbackId}/thumbnail.png`,
      };
    }

    const responseData = {
      success: true,
      playbackId: playbackId,
      src: playbackSrc,
      urls: {
        hls: Array.isArray(playbackSrc)
          ? `https://livepeercdn.studio/hls/${playbackId}/index.m3u8`
          : playbackSrc?.hls ||
            `https://livepeercdn.studio/hls/${playbackId}/index.m3u8`,
        webrtc: Array.isArray(playbackSrc)
          ? `https://livepeercdn.studio/webrtc/${playbackId}`
          : playbackSrc?.webrtc ||
            `https://livepeercdn.studio/webrtc/${playbackId}`,
        thumbnail: Array.isArray(playbackSrc)
          ? `https://livepeercdn.studio/hls/${playbackId}/thumbnail.png`
          : playbackSrc?.thumbnail ||
            `https://livepeercdn.studio/hls/${playbackId}/thumbnail.png`,
      },
      streamInfo: streamInfo,
      timestamp: new Date().toISOString(),
    };

    console.log("✅ Playback response prepared:", responseData);

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("❌ Playback source error:", error);

    // Detailed error logging
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : "";

    console.log("Error details:", {
      message: errorMessage,
      stack: errorStack,
      playbackId: params?.playbackId,
    });

    if (error instanceof Error) {
      if (
        errorMessage.includes("ENOTFOUND") ||
        errorMessage.includes("ECONNREFUSED")
      ) {
        return NextResponse.json(
          {
            error: "Streaming service unavailable",
            details: "Cannot connect to Livepeer servers",
            retry: true,
          },
          { status: 503 },
        );
      }

      if (errorMessage.includes("timeout")) {
        return NextResponse.json(
          {
            error: "Request timeout",
            details: "Livepeer API request timed out",
            retry: true,
          },
          { status: 504 },
        );
      }
    }

    return NextResponse.json(
      {
        error: "Failed to get playback source",
        details: errorMessage,
        playbackId: params?.playbackId || "unknown",
      },
      { status: 500 },
    );
  }
}
