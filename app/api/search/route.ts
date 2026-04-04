import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";

const isRateLimited = createRateLimiter(60_000, 30);

type SearchType = "all" | "users" | "streams" | "categories";

const ALLOWED_TYPES = new Set<SearchType>([
  "all",
  "users",
  "streams",
  "categories",
]);

function parseLimit(rawLimit: string | null): number {
  const parsedLimit = Number.parseInt(rawLimit ?? "10", 10);
  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
    return 10;
  }
  return Math.min(parsedLimit, 25);
}

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

  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const typeParam = (searchParams.get("type")?.trim() ?? "all") as SearchType;
    const limit = parseLimit(searchParams.get("limit"));

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(typeParam)) {
      return NextResponse.json(
        { error: "Invalid search type" },
        { status: 400 }
      );
    }

    if (query.length < 2) {
      return NextResponse.json(
        { query, type: typeParam, users: [], streams: [], categories: [] },
        { headers: { "Cache-Control": "public, s-maxage=5" } }
      );
    }

    const searchPattern = `%${query}%`;
    const normalizedQuery = query.toLowerCase();

    const usersPromise =
      typeParam === "all" || typeParam === "users"
        ? sql`
            SELECT
              id,
              username,
              avatar,
              is_live,
              bio,
              (SELECT COUNT(*)::int FROM user_follows uf WHERE uf.followee_id = users.id) AS follower_count
            FROM users
            WHERE username ILIKE ${searchPattern}
            ORDER BY is_live DESC, follower_count DESC, similarity(username, ${query}) DESC
            LIMIT ${limit}
          `
        : Promise.resolve({ rows: [] });

    const streamsPromise =
      typeParam === "all" || typeParam === "streams"
        ? sql`
            SELECT
              id,
              username,
              avatar,
              current_viewers,
              COALESCE(creator->>'streamTitle', username || '''s stream') AS stream_title,
              COALESCE(creator->>'category', 'General') AS category,
              COALESCE(
                ARRAY(
                  SELECT jsonb_array_elements_text(COALESCE(creator->'tags', '[]'::jsonb))
                ),
                ARRAY[]::text[]
              ) AS tags
            FROM users
            WHERE is_live = TRUE
              AND (
                COALESCE(creator->>'streamTitle', '') ILIKE ${searchPattern}
                OR COALESCE(creator->>'category', '') ILIKE ${searchPattern}
                OR EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements_text(COALESCE(creator->'tags', '[]'::jsonb)) AS tag
                  WHERE LOWER(tag) = ${normalizedQuery}
                     OR LOWER(tag) LIKE ${searchPattern}
                )
              )
            ORDER BY current_viewers DESC, similarity(COALESCE(creator->>'streamTitle', ''), ${query}) DESC
            LIMIT ${limit}
          `
        : Promise.resolve({ rows: [] });

    const categoriesPromise =
      typeParam === "all" || typeParam === "categories"
        ? sql`
            SELECT
              id,
              title,
              tags,
              imageurl
            FROM stream_categories
            WHERE is_active = TRUE
              AND (
                title ILIKE ${searchPattern}
                OR EXISTS (
                  SELECT 1
                  FROM UNNEST(COALESCE(tags, ARRAY[]::text[])) AS tag
                  WHERE LOWER(tag) = ${normalizedQuery}
                     OR LOWER(tag) LIKE ${searchPattern}
                )
              )
            ORDER BY similarity(title, ${query}) DESC, created_at DESC
            LIMIT ${limit}
          `
        : Promise.resolve({ rows: [] });

    const [usersResult, streamsResult, categoriesResult] = await Promise.all([
      usersPromise,
      streamsPromise,
      categoriesPromise,
    ]);

    return NextResponse.json(
      {
        query,
        type: typeParam,
        users: usersResult.rows,
        streams: streamsResult.rows,
        categories: categoriesResult.rows,
      },
      { headers: { "Cache-Control": "public, s-maxage=5" } }
    );
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: "Failed to search" }, { status: 500 });
  }
}
