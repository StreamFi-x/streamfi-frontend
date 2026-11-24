import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { CACHE_POLICIES } from "@/lib/cache";
import {
  buildRankedPage,
  rankedKeysetBounds,
  readRankedPageParams,
} from "@/lib/pagination/ranked";

interface TopUserRow {
  id: string;
  username: string;
  avatar: string | null;
  is_live: boolean;
  current_viewers: number;
  follower_count: number;
}

/**
 * GET /api/users/top?limit=5&cursor=<nextCursor>
 * Returns users with the most followers — used for the Recommended sidebar section.
 * Uses the shared ranked cursor contract: { items, nextCursor, hasMore } (plus
 * `users` alias for backwards compatibility).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const params = readRankedPageParams(searchParams, {
    defaultLimit: 5,
    maxLimit: 20,
    scoreCount: 2,
  });
  if (!params.ok) {
    return params.response;
  }
  const { page } = params;
  const bound = rankedKeysetBounds(page.after, 2);

  try {
    const { rows } = await sql<TopUserRow>`
      WITH ranked_users AS (
        SELECT
          u.id,
          u.username,
          u.avatar,
          -- Mask live status & viewer count when stream is private
          CASE WHEN COALESCE(u.stream_privacy, 'public') = 'public'
               THEN u.is_live ELSE FALSE END AS is_live,
          CASE WHEN COALESCE(u.stream_privacy, 'public') = 'public'
               THEN COALESCE(u.current_viewers, 0)::int ELSE 0 END AS current_viewers,
          COALESCE(fc.follower_count, 0)::int AS follower_count
        FROM users u
        LEFT JOIN (
          SELECT f.followee_id, COUNT(*)::int AS follower_count
          FROM user_follows f
          JOIN users fu ON fu.id = f.follower_id AND fu.deleted_at IS NULL
          GROUP BY f.followee_id
        ) fc ON fc.followee_id = u.id
        WHERE u.username IS NOT NULL
          AND u.deleted_at IS NULL
      )
      SELECT id, username, avatar, is_live, current_viewers, follower_count
      FROM ranked_users
      WHERE (follower_count, current_viewers, id) < (
        ${bound.scores[0]}::int,
        ${bound.scores[1]}::int,
        ${bound.id}::uuid
      )
      ORDER BY follower_count DESC, current_viewers DESC, id DESC
      LIMIT ${page.limit + 1}
    `;

    const pageData = buildRankedPage(
      rows,
      page.limit,
      ({ id: _id, ...user }) => user,
      row => ({
        scores: [row.follower_count, row.current_viewers],
        id: row.id,
      })
    );

    const res = NextResponse.json({
      ...pageData,
      users: pageData.items,
    });
    res.headers.set("Cache-Control", CACHE_POLICIES.publicListing.cacheControl);
    return res;
  } catch (error) {
    console.error("[users/top] DB error:", error);
    return NextResponse.json(
      { error: "Failed to fetch top users" },
      { status: 500 }
    );
  }
}
