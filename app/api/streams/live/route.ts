import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

const STREAMS_PER_PAGE = 50;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const viewerWallet = searchParams.get("viewer_wallet");
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

    // When personalising (following-first JS sort), fetch 2× the page so
    // followed streams with lower viewer counts still make page 1.
    const fetchLimit = viewerWallet ? STREAMS_PER_PAGE * 2 : STREAMS_PER_PAGE;

    const liveStreamsResult = await sql`
      SELECT
        id, username, avatar,
        mux_playback_id,
        current_viewers, total_views,
        stream_started_at, creator
      FROM users
      WHERE is_live = true
      ORDER BY current_viewers DESC
      LIMIT ${fetchLimit} OFFSET ${offset}
    `;

    if (liveStreamsResult.rows.length === 0) {
      return NextResponse.json(
        { streams: [], hasMore: false, nextOffset: null },
        { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } }
      );
    }

    // Get viewer's following list for personalised sort
    let viewerFollowing: string[] = [];
    if (viewerWallet) {
      const { rows: followRows } = await sql`
        SELECT uf.followee_id
        FROM   user_follows uf
        JOIN   users v ON v.id = uf.follower_id
        WHERE  LOWER(v.wallet) = LOWER(${viewerWallet})
      `;
      viewerFollowing = followRows.map(r => r.followee_id as string);
    }

    const streams = liveStreamsResult.rows.map(row => {
      const creator = row.creator || {};
      return {
        id: row.id,
        username: row.username,
        avatar: row.avatar ?? null,
        playbackId: row.mux_playback_id ?? "",
        title: creator.streamTitle || "Untitled Stream",
        description: creator.description || "",
        category: creator.category || "",
        tags: creator.tags || [],
        thumbnail: creator.thumbnail ?? null,
        viewerCount: row.current_viewers || 0,
        totalViews: row.total_views || 0,
        isFollowing: viewerFollowing.includes(row.id),
        streamStartedAt: row.stream_started_at,
      };
    });

    // Followed streams bubble to top; within each group sort by viewer count
    if (viewerWallet) {
      streams.sort((a, b) => {
        if (a.isFollowing !== b.isFollowing) {return a.isFollowing ? -1 : 1;}
        return b.viewerCount - a.viewerCount;
      });
    }

    const page = streams.slice(0, STREAMS_PER_PAGE);
    const hasMore = liveStreamsResult.rows.length === fetchLimit;
    const nextOffset = hasMore ? offset + STREAMS_PER_PAGE : null;

    return NextResponse.json(
      { streams: page, hasMore, nextOffset },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } }
    );
  } catch (error) {
    console.error("Error fetching live streams:", error);
    return NextResponse.json({ error: "Failed to fetch live streams" }, { status: 500 });
  }
}
