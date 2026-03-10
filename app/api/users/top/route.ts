import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

/**
 * GET /api/users/top?limit=5
 * Returns users with the most followers — used for the Recommended sidebar section.
 */
export async function GET(req: NextRequest) {
  const limit = Math.min(
    parseInt(new URL(req.url).searchParams.get("limit") ?? "5", 10),
    20
  );

  try {
    const { rows } = await sql`
      SELECT
        u.username,
        u.avatar,
        u.is_live,
        u.current_viewers,
        (SELECT COUNT(*)::int FROM user_follows WHERE followee_id = u.id) AS follower_count
      FROM users u
      WHERE u.username IS NOT NULL
      ORDER BY follower_count DESC, u.current_viewers DESC
      LIMIT ${limit}
    `;

    const res = NextResponse.json({ users: rows });
    res.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=120"
    );
    return res;
  } catch (error) {
    console.error("[users/top] DB error:", error);
    return NextResponse.json(
      { error: "Failed to fetch top users" },
      { status: 500 }
    );
  }
}
