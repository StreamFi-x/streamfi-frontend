import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { ensureAnalyticsSchema } from "@/app/api/routes-f/analytics/_lib/db";
import { ensureGiftSchema } from "@/app/api/routes-f/gifts/_lib/db";

const leaderboardQuerySchema = z.object({
  type: z
    .enum(["earnings", "tips_sent", "watch_time", "new_followers"])
    .default("earnings"),
  limit: z.coerce.number().min(1).max(20).default(20),
  period: z.enum(["weekly", "monthly", "alltime"]).default("weekly"),
});

function getWindowStart(
  period: "weekly" | "monthly" | "alltime"
): string | null {
  const now = new Date();

  if (period === "alltime") {
    return null;
  }

  if (period === "weekly") {
    const start = new Date(now);
    const day = start.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setUTCDate(start.getUTCDate() - diff);
    start.setUTCHours(0, 0, 0, 0);
    return start.toISOString();
  }

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return start.toISOString();
}

function cacheHeaders() {
  return {
    "Cache-Control":
      "public, max-age=600, s-maxage=600, stale-while-revalidate=60",
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const queryResult = validateQuery(
    new URL(req.url).searchParams,
    leaderboardQuerySchema
  );
  if (queryResult instanceof Response) {
    return queryResult;
  }

  const { type, limit } = queryResult.data;
  const period = queryResult.data.period ?? "weekly";
  const since = getWindowStart(period);

  try {
    await Promise.all([ensureGiftSchema(), ensureAnalyticsSchema()]);

    let entries: unknown[] = [];

    if (type === "earnings") {
      const { rows } = await sql`
        SELECT
          ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(gt.amount_usdc), 0) DESC, u.username ASC)::int AS rank,
          u.username,
          u.avatar AS avatar_url,
          COALESCE(SUM(gt.amount_usdc), 0)::numeric(20,2)::text AS value
        FROM users u
        JOIN gift_transactions gt ON gt.creator_id = u.id
        WHERE (${since}::timestamptz IS NULL OR gt.created_at >= ${since})
        GROUP BY u.id, u.username, u.avatar
        ORDER BY COALESCE(SUM(gt.amount_usdc), 0) DESC, u.username ASC
        LIMIT ${limit}
      `;
      entries = rows;
    } else if (type === "tips_sent") {
      const { rows } = await sql`
        SELECT
          ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(gt.amount_usdc), 0) DESC, u.username ASC)::int AS rank,
          u.username,
          u.avatar AS avatar_url,
          COALESCE(SUM(gt.amount_usdc), 0)::numeric(20,2)::text AS value
        FROM users u
        JOIN gift_transactions gt ON gt.supporter_id = u.id
        WHERE gt.supporter_id IS NOT NULL
          AND (${since}::timestamptz IS NULL OR gt.created_at >= ${since})
        GROUP BY u.id, u.username, u.avatar
        ORDER BY COALESCE(SUM(gt.amount_usdc), 0) DESC, u.username ASC
        LIMIT ${limit}
      `;
      entries = rows;
    } else if (type === "watch_time") {
      const { rows } = await sql`
        SELECT
          ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(e.duration_seconds), 0) DESC, u.username ASC)::int AS rank,
          u.username,
          u.avatar AS avatar_url,
          COALESCE(SUM(e.duration_seconds), 0)::int AS value
        FROM users u
        JOIN route_f_watch_events e ON e.user_id = u.id
        WHERE (${since}::timestamptz IS NULL OR e.watched_at >= ${since})
        GROUP BY u.id, u.username, u.avatar
        ORDER BY COALESCE(SUM(e.duration_seconds), 0) DESC, u.username ASC
        LIMIT ${limit}
      `;
      entries = rows;
    } else {
      const { rows } = await sql`
        SELECT
          ROW_NUMBER() OVER (ORDER BY COUNT(uf.follower_id) DESC, u.username ASC)::int AS rank,
          u.username,
          u.avatar AS avatar_url,
          COUNT(uf.follower_id)::int AS value
        FROM users u
        JOIN user_follows uf ON uf.followee_id = u.id
        WHERE (${since}::timestamptz IS NULL OR uf.created_at >= ${since})
        GROUP BY u.id, u.username, u.avatar
        ORDER BY COUNT(uf.follower_id) DESC, u.username ASC
        LIMIT ${limit}
      `;
      entries = rows;
    }

    return NextResponse.json(
      {
        type,
        period,
        generated_at: new Date().toISOString(),
        entries,
      },
      { headers: cacheHeaders() }
    );
  } catch (error) {
    console.error("[routes-f leaderboard/weekly GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
