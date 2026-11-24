import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { CACHE_POLICIES } from "@/lib/cache";
import {
  buildRankedPage,
  rankedKeysetBounds,
  readRankedPageParams,
} from "@/lib/pagination/ranked";

const STREAMS_PER_PAGE = 50;

interface LiveStreamRow {
  id: string;
  username: string;
  avatar: string | null;
  mux_playback_id: string | null;
  current_viewers: number;
  total_views: number | null;
  stream_started_at: string | null;
  creator: {
    streamTitle?: string;
    description?: string;
    category?: string;
    tags?: string[];
    thumbnail?: string | null;
  } | null;
  is_following: number;
}

/**
 * GET /api/streams/live?limit=50&cursor=<nextCursor>&viewer_wallet=<wallet>
 * Returns currently live public streams ordered by following status (when
 * viewer_wallet is provided), viewer count descending, and id descending.
 * Uses the shared ranked cursor contract: { items, nextCursor, hasMore } (plus
 * `streams` alias for backwards compatibility).
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const params = readRankedPageParams(searchParams, {
      defaultLimit: STREAMS_PER_PAGE,
      maxLimit: STREAMS_PER_PAGE,
      scoreCount: 2,
    });
    if (!params.ok) {
      return params.response;
    }
    const { page } = params;
    const bound = rankedKeysetBounds(page.after, 2);
    const viewerWallet = searchParams.get("viewer_wallet");

    const { rows } = viewerWallet
      ? await sql<LiveStreamRow>`
          WITH viewer_follows AS (
            SELECT uf.followee_id
            FROM user_follows uf
            JOIN users v ON v.id = uf.follower_id AND v.deleted_at IS NULL
            WHERE LOWER(v.wallet) = LOWER(${viewerWallet})
          )
          SELECT
            u.id,
            u.username,
            u.avatar,
            u.mux_playback_id,
            COALESCE(u.current_viewers, 0)::int AS current_viewers,
            u.total_views,
            u.stream_started_at,
            u.creator,
            CASE WHEN vf.followee_id IS NOT NULL THEN 1 ELSE 0 END AS is_following
          FROM users u
          LEFT JOIN viewer_follows vf ON vf.followee_id = u.id
          WHERE u.is_live = true
            AND u.deleted_at IS NULL
            AND COALESCE(u.stream_privacy, 'public') = 'public'
            AND (
              CASE WHEN vf.followee_id IS NOT NULL THEN 1 ELSE 0 END,
              COALESCE(u.current_viewers, 0)::int,
              u.id
            ) < (
              ${bound.scores[0]}::int,
              ${bound.scores[1]}::int,
              ${bound.id}::uuid
            )
          ORDER BY is_following DESC, current_viewers DESC, u.id DESC
          LIMIT ${page.limit + 1}
        `
      : await sql<LiveStreamRow>`
          SELECT
            u.id,
            u.username,
            u.avatar,
            u.mux_playback_id,
            COALESCE(u.current_viewers, 0)::int AS current_viewers,
            u.total_views,
            u.stream_started_at,
            u.creator,
            0 AS is_following
          FROM users u
          WHERE u.is_live = true
            AND u.deleted_at IS NULL
            AND COALESCE(u.stream_privacy, 'public') = 'public'
            AND (0, COALESCE(u.current_viewers, 0)::int, u.id) < (
              ${bound.scores[0]}::int,
              ${bound.scores[1]}::int,
              ${bound.id}::uuid
            )
          ORDER BY current_viewers DESC, u.id DESC
          LIMIT ${page.limit + 1}
        `;

    const pageData = buildRankedPage(
      rows,
      page.limit,
      row => {
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
          isFollowing: row.is_following === 1,
          streamStartedAt: row.stream_started_at,
        };
      },
      row => ({
        scores: [row.is_following, row.current_viewers],
        id: row.id,
      })
    );

    return NextResponse.json(
      {
        ...pageData,
        streams: pageData.items,
      },
      {
        headers: {
          "Cache-Control": CACHE_POLICIES.liveState.cacheControl,
        },
      }
    );
  } catch (error) {
    console.error("Error fetching live streams:", error);
    return NextResponse.json(
      { error: "Failed to fetch live streams" },
      { status: 500 }
    );
  }
}
