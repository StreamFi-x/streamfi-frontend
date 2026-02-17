import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const viewerWallet = searchParams.get("viewer_wallet");

    // Fetch all live streams
    const liveStreamsResult = await sql`
      SELECT
        id,
        username,
        avatar,
        bio,
        mux_playback_id,
        current_viewers,
        total_views,
        stream_started_at,
        creator,
        followers
      FROM users
      WHERE is_live = true
    `;

    if (liveStreamsResult.rows.length === 0) {
      return NextResponse.json({ streams: [] }, { status: 200 });
    }

    // Get viewer's following list if wallet provided
    let viewerFollowing: string[] = [];
    if (viewerWallet) {
      const viewerResult = await sql`
        SELECT following
        FROM users
        WHERE wallet = ${viewerWallet}
      `;

      if (viewerResult.rows.length > 0 && viewerResult.rows[0].following) {
        viewerFollowing = viewerResult.rows[0].following;
      }
    }

    // Map and sort streams
    const streams = liveStreamsResult.rows.map(row => {
      const creator = row.creator || {};
      const isFollowing = viewerFollowing.includes(row.id);

      return {
        id: row.id,
        username: row.username,
        avatar: row.avatar,
        playbackId: row.mux_playback_id,
        title: creator.streamTitle || "Untitled Stream",
        description: creator.description || "",
        category: creator.category || "",
        tags: creator.tags || [],
        thumbnail: creator.thumbnail || null,
        viewerCount: row.current_viewers || 0,
        totalViews: row.total_views || 0,
        isFollowing,
        streamStartedAt: row.stream_started_at,
      };
    });

    // Sort: followed streams first, then by viewer count descending
    streams.sort((a, b) => {
      // First priority: following status
      if (a.isFollowing && !b.isFollowing) {
        return -1;
      }
      if (!a.isFollowing && b.isFollowing) {
        return 1;
      }

      // Second priority: viewer count
      return b.viewerCount - a.viewerCount;
    });

    return NextResponse.json({ streams }, { status: 200 });
  } catch (error) {
    console.error("Error fetching live streams:", error);
    return NextResponse.json(
      { error: "Failed to fetch live streams" },
      { status: 500 }
    );
  }
}
