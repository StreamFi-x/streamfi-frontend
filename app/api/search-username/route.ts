import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";

// 30 searches per minute per IP — ILIKE is fast with the trgm index but still DB work
const isRateLimited = createRateLimiter(60_000, 30);

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

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    // Single-char queries match too broadly and defeat the trgm index's usefulness
    if (query.length < 2) {
      return NextResponse.json({ usernames: [] });
    }

    const results = await sql`
      SELECT id, username, avatar
      FROM users
      WHERE username ILIKE ${"%" + query + "%"}
      LIMIT 8
    `;

    return NextResponse.json(
      { users: results.rows },
      { headers: { "Cache-Control": "public, s-maxage=5" } }
    );
  } catch (error) {
    console.error("Username search error:", error);
    return NextResponse.json(
      { error: "Failed to search usernames" },
      { status: 500 }
    );
  }
}
