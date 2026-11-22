import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { CACHE_POLICIES } from "@/lib/cache";
import {
  buildRankedPage,
  rankedBounds,
  readRankedParams,
} from "@/lib/pagination/ranked";

const SCORE_COUNT = 2;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * GET /api/streams/live?limit=&cursor=&viewer_wallet=
 * Ranked by viewers (followed streams first when viewer_wallet is given).
 * Envelope: { items, nextCursor, hasMore }; `streams` mirrors `items` for
 * existing clients.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const viewerWallet = searchParams.get("viewer_wallet");

    const parsed = readRankedParams(searchParams, SCORE_COUNT, {
      defaultLimit: DEFAULT_LIMIT,
      maxLimit: MAX_LIMIT,
    });
    if (!parsed.ok) {
      return parsed.response;
    }
    const { page } = parsed;
    const bounds = rankedBounds(page.after, SCORE_COUNT);

    // Followed streams rank first for a personalised viewer, so the ranking
    // (and therefore the cursor) is [is_following, current_viewers, id].
    const liveStreamsResult = await sql`
      SELECT * FROM (
        SELECT
          u.id, u.username, u.avatar,
          u.mux_playback_id,
          u.current_viewers, u.total_views,
          u.stream_started_at, u.creator,
          CASE WHEN ${viewerWallet}::text IS NOT NULL AND EXISTS (
            SELECT 1
            FROM user_follows uf
            JOIN users v ON v.id = uf.follower_id AND v.deleted_at IS NULL
            WHERE uf.followee_id = u.id
              AND LOWER(v.wallet) = LOWER(${viewerWallet}::text)
          ) THEN 1 ELSE 0 END AS is_following
        FROM users u
        WHERE u.is_live = true
          AND u.deleted_at IS NULL
          AND COALESCE(u.stream_privacy, 'public') = 'public'
      ) ranked
      WHERE (${bounds.isFirstPage}::boolean OR (
        ranked.is_following, COALESCE(ranked.current_viewers, 0), ranked.id
      ) < (${bounds.scores[0]}::int, ${bounds.scores[1]}::int, ${bounds.id}::uuid))
      ORDER BY ranked.is_following DESC,
               COALESCE(ranked.current_viewers, 0) DESC,
               ranked.id DESC
      LIMIT ${page.limit + 1}
    `;

    const result = buildRankedPage(
      liveStreamsResult.rows.map(row => ({
        ...row,
        id: row.id as string,
        rank_scores: [
          Number(row.is_following),
          Number(row.current_viewers ?? 0),
        ],
      })),
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
      }
    );

    return NextResponse.json(
      { ...result, streams: result.items },
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
