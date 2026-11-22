import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { CACHE_POLICIES } from "@/lib/cache";
import {
  buildRankedPage,
  rankedBounds,
  readRankedParams,
} from "@/lib/pagination/ranked";
import { apiInternalError, apiSuccess } from "@/lib/api";

const SCORE_COUNT = 2;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

/**
 * GET /api/users/top?limit=5&cursor=
 * Users with the most followers (ties broken by viewers, then id), used for
 * the Recommended sidebar section.
 * Envelope: { items, nextCursor, hasMore }; `users` mirrors `items` for
 * existing clients.
 */
export async function GET(req: NextRequest) {
  const parsed = readRankedParams(new URL(req.url).searchParams, SCORE_COUNT, {
    defaultLimit: DEFAULT_LIMIT,
    maxLimit: MAX_LIMIT,
  });
  if (!parsed.ok) {
    return parsed.response;
  }
  const { page } = parsed;
  const bounds = rankedBounds(page.after, SCORE_COUNT);

  try {
    const { rows } = await sql`
      SELECT * FROM (
        SELECT
          u.id,
          u.username,
          u.avatar,
          -- Mask live status & viewer count when stream is private
          CASE WHEN COALESCE(u.stream_privacy, 'public') = 'public'
               THEN u.is_live ELSE FALSE END AS is_live,
          CASE WHEN COALESCE(u.stream_privacy, 'public') = 'public'
               THEN u.current_viewers ELSE 0 END AS current_viewers,
          COALESCE(fc.follower_count, 0)::int AS follower_count,
          COALESCE(u.current_viewers, 0)::int AS rank_viewers
        FROM users u
        LEFT JOIN (
          SELECT f.followee_id, COUNT(*)::int AS follower_count
          FROM user_follows f
          JOIN users fu ON fu.id = f.follower_id AND fu.deleted_at IS NULL
          GROUP BY f.followee_id
        ) fc ON fc.followee_id = u.id
        WHERE u.username IS NOT NULL
          AND u.deleted_at IS NULL
      ) ranked
      WHERE (${bounds.isFirstPage}::boolean OR (
        ranked.follower_count, ranked.rank_viewers, ranked.id
      ) < (${bounds.scores[0]}::int, ${bounds.scores[1]}::int, ${bounds.id}::uuid))
      ORDER BY ranked.follower_count DESC,
               ranked.rank_viewers DESC,
               ranked.id DESC
      LIMIT ${page.limit + 1}
    `;

    const result = buildRankedPage(
      rows.map(row => ({
        ...row,
        id: row.id as string,
        rank_scores: [Number(row.follower_count), Number(row.rank_viewers)],
      })),
      page.limit,
      row => ({
        username: row.username,
        avatar: row.avatar,
        is_live: row.is_live,
        current_viewers: row.current_viewers,
        follower_count: row.follower_count,
      })
    );

    const res = NextResponse.json({ ...result, users: result.items });
    res.headers.set("Cache-Control", CACHE_POLICIES.publicListing.cacheControl);
    return res;
  } catch (error) {
    console.error("[users/top] DB error:", error);
    return NextResponse.json(
      { error: "Failed to fetch top users" },
      { status: 500 }
||||||| de1b138e
    const res = NextResponse.json({ users: rows });
    res.headers.set("Cache-Control", CACHE_POLICIES.publicListing.cacheControl);
    return res;
  } catch (error) {
    console.error("[users/top] DB error:", error);
    return NextResponse.json(
      { error: "Failed to fetch top users" },
      { status: 500 }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[users/top] DB error:", error);
    return apiInternalError("Failed to fetch top users");
  }
}
