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

    if (!playbackId) {
      console.warn("[routes-f] Playback request missing playbackId");
      return NextResponse.json(
        { error: "Playback ID is required" },
        { status: 400 }
      );
    }

    console.log(`[routes-f] Playback request for: ${playbackId}`);

    // Fetch stream info from DB
    let streamInfo: null | Record<string, any> = null;
    try {
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
          currentViewers: row.current_viewers ?? 0,
          totalViews: row.total_views ?? 0,
          title: row.creator?.streamTitle ?? "Live Stream",
          category: row.creator?.category ?? "General",
          tags: row.creator?.tags ?? [],
        };
        console.log("[routes-f] Stream info found:", streamInfo);
      } else {
        console.log("[routes-f] No stream info found in database for:", playbackId);
      }
    } catch (dbError) {
      console.error("[routes-f] DB query failed:", dbError);
    }

    // Get playback URL from Mux
    let playbackSrc: string | null = null;
    try {
      playbackSrc = await getPlaybackUrl(playbackId);
      console.log("[routes-f] Playback source retrieved:", playbackSrc);
    } catch (muxError) {
      console.error("[routes-f] Failed to get Mux playback URL:", muxError);
    }

    if (!playbackSrc) {
      return NextResponse.json(
        { error: "Playback source unavailable", playbackId },
        { status: 503 }
      );
    }

    const responseData = {
      success: true,
      playbackId,
      src: playbackSrc,
      urls: {
        hls: playbackSrc,
        thumbnail: `https://image.mux.com/${playbackId}/thumbnail.jpg`,
      },
      streamInfo,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("[routes-f] Playback source error:", error);
    return NextResponse.json(
      {
        error: "Failed to get playback source",
        details: error instanceof Error ? error.message : "Unknown error",
        playbackId,
      },
      { status: 500 }
    );
  }
}