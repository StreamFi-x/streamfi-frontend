import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";
import { logSearchQuery, normalizeQuery } from "@/lib/analytics/search-query-logger";
import { rankSearchResults } from "@/lib/search-ranking";
import { logger } from "@/lib/tracing/logger";

// 30 searches per minute per IP — ILIKE is fast with the trgm index but still DB work
const isRateLimited = createRateLimiter(60_000, 30);

/**
 * Search usernames with typo tolerance via pg_trgm similarity
 * Falls back to ILIKE for exact prefix matches, then fuzzy matches
 * All results pass through ranking to ensure quality and proper ordering
 */
export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const startTime = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "8", 10), 20);

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    // Single-char queries match too broadly and defeat the trgm index's usefulness
    if (query.length < 2) {
      // Still log as zero-result for analytics
      const viewerId = searchParams.get("viewer_id") || undefined;
      await logSearchQuery({
        query_text: query,
        normalized_query: normalizeQuery(query),
        search_source: 'general',
        result_count: 0,
        viewer_id: viewerId,
        query_duration_ms: Date.now() - startTime,
        client_ip: ip,
      }).catch(() => {}); // Silently ignore logging errors
      return NextResponse.json({ users: [] });
    }

    // Fetch both exact and fuzzy matches in one query for efficiency
    const { rows } = await sql`
      SELECT
        id,
        username,
        avatar,
        follower_count,
        is_live,
        current_viewers,
        -- Similarity score for fuzzy matching (0-1)
        similarity(username, ${query}) as sim_score,
        CASE
          WHEN username ILIKE ${query + '%'} THEN 1000  -- Exact prefix match: highest priority
          WHEN username ILIKE ${'%' + query + '%'} THEN 100  -- Substring match
          ELSE similarity(username, ${query}) * 100  -- Fuzzy match: use similarity score (0-100)
        END as relevance_score
      FROM users
      WHERE
        username IS NOT NULL
        AND (
          -- Exact/prefix/substring match
          username ILIKE ${query + '%'}
          OR username ILIKE ${'%' + query + '%'}
          -- Fuzzy match: similarity >= 0.3 (tuned to catch typos without flood)
          OR similarity(username, ${query}) >= 0.3
        )
      ORDER BY relevance_score DESC, similarity(username, ${query}) DESC
      LIMIT ${limit * 2}  -- Fetch more, then rank/filter
    `;

    // Rank results using comprehensive algorithm
    const ranked = rankSearchResults(query, rows.map(row => ({
      id: row.id,
      title: row.username,
      followerCount: row.follower_count,
      isLive: row.is_live,
      lastActiveAt: new Date(),
    })));

    const results = ranked.slice(0, limit).map(r => {
      const orig = rows.find(row => row.id === r.item.id);
      return {
        id: orig.id,
        username: orig.username,
        avatar: orig.avatar,
        follower_count: orig.follower_count,
        is_live: orig.is_live,
        current_viewers: orig.current_viewers,
        relevance_score: r.score,
      };
    });

    const queryDuration = Date.now() - startTime;

    // Log search query for analytics (async, non-blocking)
    const viewerId = searchParams.get("viewer_id") || undefined;
    await logSearchQuery({
      query_text: query,
      normalized_query: normalizeQuery(query),
      search_source: 'general',
      result_count: results.length,
      viewer_id: viewerId,
      query_duration_ms: queryDuration,
      client_ip: ip,
    }).catch(() => {}); // Silently ignore logging errors

    logger.debug('[search-username] Query completed', {
      operation: 'searchUsername',
      query_length: query.length,
      results_count: results.length,
      duration_ms: queryDuration,
    });

    return NextResponse.json(
      { users: results },
      { headers: { "Cache-Control": "public, s-maxage=5" } }
    );
  } catch (error) {
    const queryDuration = Date.now() - startTime;
    logger.error("[search-username] Search error:", {
      operation: 'searchUsername',
      error: error instanceof Error ? error.message : String(error),
      duration_ms: queryDuration,
    });
    return NextResponse.json(
      { error: "Failed to search usernames" },
      { status: 500 }
    );
  }
}
