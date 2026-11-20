import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { CACHE_POLICIES, cacheHeaders } from "@/lib/cache";
import {
  buildPage,
  keysetBounds,
  readPageParams,
  withoutCursorTs,
  type KeysetRow,
} from "@/lib/pagination/cursor";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  try {
    // Get the user to find their ID
    const { rows: userRows } = await sql`
      SELECT id FROM users WHERE username = ${username} AND deleted_at IS NULL
    `;
    if (userRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const userId = userRows[0].id;

    // Read pagination parameters
    const params_obj = readPageParams(new URL(req.url).searchParams, {
      defaultLimit: 20,
      maxLimit: 50,
    });
    if (!params_obj.ok) {
      return params_obj.response;
    }
    const { page } = params_obj;
    const bound = keysetBounds(page.after);

    // Query followers from user_follows table using the same pattern as /following
    const { rows } = await sql<KeysetRow>`
      SELECT
        u.id,
        u.username,
        u.avatar,
        u.bio,
        u.follower_count,
        u.created_at,
        to_char(u.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts
      FROM user_follows uf
      JOIN users u ON uf.follower_id = u.id
      WHERE uf.following_id = ${userId}
        AND u.deleted_at IS NULL
        AND (u.created_at, u.id) < (${bound.ts}::timestamptz, ${bound.id}::uuid)
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT ${page.limit + 1}
    `;

    return NextResponse.json(
      buildPage(rows, page.limit, withoutCursorTs),
      { headers: cacheHeaders("userFollowers") }
    );
  } catch (error) {
    console.error("Fetch followers error:", error);
    return NextResponse.json(
      { error: "Failed to fetch followers" },
      { status: 500 }
    );
  }
}
