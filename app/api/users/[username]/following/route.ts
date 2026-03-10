import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  try {
    // Resolve the username to an id first (uses idx_users_username_lower)
    const { rows: userRows } = await sql`
      SELECT id FROM users WHERE LOWER(username) = LOWER(${username}) LIMIT 1
    `;
    if (userRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = userRows[0].id;

    const { rows: followingProfiles } = await sql`
      SELECT u.username, u.avatar, u.bio, u.is_live
      FROM   user_follows uf
      JOIN   users u ON u.id = uf.followee_id
      WHERE  uf.follower_id = ${userId}
      ORDER  BY uf.created_at DESC
    `;

    return NextResponse.json({ following: followingProfiles }, {
      headers: { "Cache-Control": "public, s-maxage=30" },
    });
  } catch (error) {
    console.error("Fetch following error:", error);
    return NextResponse.json(
      { error: "Failed to fetch following" },
      { status: 500 }
    );
  }
}
