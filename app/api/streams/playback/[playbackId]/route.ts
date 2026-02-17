import { NextResponse } from "next/server";
import { getPlaybackUrl } from "@/lib/mux/server";
import { sql } from "@vercel/postgres";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ playbackId: string }> }
) {
  let playbackId: string = "unknown";

  try {
    const { playbackId: paramPlaybackId } = await params;
    playbackId = paramPlaybackId;

    console.log("🎬 Playback request for:", playbackId);

    if (!playbackId) {
      return NextResponse.json(
        { error: "Playback ID is required" },
        { status: 400 }
      );
    }

    let streamInfo = null;

    try {
      console.log("🔍 Checking database for playback ID...");
      const streamCheck = await sql`
        SELECT id, username, is_live, creator, current_viewers, total_views
        FROM users
        WHERE mux_playback_id = ${playbackId}
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

    console.log("🎬 Getting playback source from Mux...");
    const playbackSrc = await getPlaybackUrl(playbackId);
    console.log("✅ Playback source retrieved:", playbackSrc);

    const responseData = {
      success: true,
      playbackId: playbackId,
      src: playbackSrc,
      urls: {
        hls: playbackSrc,
        thumbnail: `https://image.mux.com/${playbackId}/thumbnail.jpg`,
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

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : "";

    console.log("Error details:", {
      message: errorMessage,
      stack: errorStack,
      playbackId: playbackId,
    });

    return NextResponse.json(
      {
        error: "Failed to get playback source",
        details: errorMessage,
        playbackId: playbackId,
      },
      { status: 500 }
    );
  }
}
