import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

/**
 * GET /api/routes-f/leaderboard
 * Query params: ?category=earnings|viewers|followers|streams&period=7d|30d|all&limit=20
 */

const leaderboardQuerySchema = z.object({
  category: z
    .enum(["earnings", "viewers", "followers", "streams"])
    .default("earnings"),
  period: z.enum(["7d", "30d", "all"]).default("7d"),
  limit: z.coerce.number().min(1).max(100).default(20),
});

function periodToDate(period: "7d" | "30d" | "all"): Date {
  if (period === "7d") {
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }
  if (period === "30d") {
    return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }
  return new Date(0); // epoch — effectively "no filter"
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, leaderboardQuerySchema);
  if (queryResult instanceof Response) {
    return queryResult;
  }

  const { category, period, limit } = queryResult.data;
  const since = periodToDate(period ?? "7d").toISOString();

  try {
    let entries: unknown[] = [];

    if (category === "earnings") {
      const { rows } = await sql`
        SELECT
          ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(t.amount_usdc), 0) DESC)::int AS rank,
          u.username,
          u.avatar,
          u.is_live,
          COALESCE(SUM(t.amount_usdc), 0)::numeric(20,2)::text AS value,
          'USDC earned' AS value_label
        FROM users u
        LEFT JOIN transactions t
          ON t.recipient_id = u.id AND t.created_at >= ${since}
        GROUP BY u.id, u.username, u.avatar, u.is_live
        ORDER BY COALESCE(SUM(t.amount_usdc), 0) DESC
        LIMIT ${limit}
      `;
      entries = rows;
    } else if (category === "viewers") {
      const { rows } = await sql`
        SELECT
          ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(ss.peak_viewers), 0) DESC)::int AS rank,
          u.username,
          u.avatar,
          u.is_live,
          COALESCE(SUM(ss.peak_viewers), 0)::text AS value,
          'peak viewers' AS value_label
        FROM users u
        LEFT JOIN stream_sessions ss
          ON ss.user_id = u.id AND ss.created_at >= ${since}
        GROUP BY u.id, u.username, u.avatar, u.is_live
        ORDER BY COALESCE(SUM(ss.peak_viewers), 0) DESC
        LIMIT ${limit}
      `;
      entries = rows;
    } else if (category === "followers") {
      const { rows } = await sql`
        SELECT
          ROW_NUMBER() OVER (ORDER BY COUNT(f.follower_id) DESC)::int AS rank,
          u.username,
          u.avatar,
          u.is_live,
          COUNT(f.follower_id)::text AS value,
          'followers' AS value_label
        FROM users u
        LEFT JOIN follows f
          ON f.following_id = u.id AND f.created_at >= ${since}
        GROUP BY u.id, u.username, u.avatar, u.is_live
        ORDER BY COUNT(f.follower_id) DESC
        LIMIT ${limit}
      `;
      entries = rows;
    } else {
      // streams
      const { rows } = await sql`
        SELECT
          ROW_NUMBER() OVER (ORDER BY COUNT(ss.id) DESC)::int AS rank,
          u.username,
          u.avatar,
          u.is_live,
          COUNT(ss.id)::text AS value,
          'streams' AS value_label
        FROM users u
        LEFT JOIN stream_sessions ss
          ON ss.user_id = u.id AND ss.created_at >= ${since}
        GROUP BY u.id, u.username, u.avatar, u.is_live
        ORDER BY COUNT(ss.id) DESC
        LIMIT ${limit}
      `;
      entries = rows;
    }

    return NextResponse.json({
      category,
      period,
      entries,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[leaderboard] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
