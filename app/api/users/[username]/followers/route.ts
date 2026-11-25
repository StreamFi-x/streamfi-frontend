import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { CACHE_POLICIES } from "@/lib/cache";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  try {
    // Resolve the username to an id first (case-insensitive, non-deleted)
    const { rows: userRows } = await sql`
      SELECT id FROM users
      WHERE LOWER(username) = LOWER(${username}) AND deleted_at IS NULL
      LIMIT 1
    `;
    if (userRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = userRows[0].id;

    // Query active followers from user_follows join table
    const { rows: followerProfiles } = await sql`
      SELECT u.username, u.avatar, u.bio, u.is_live
      FROM   user_follows uf
      JOIN   users u ON u.id = uf.follower_id AND u.deleted_at IS NULL
      WHERE  uf.followee_id = ${userId}
      ORDER  BY uf.created_at DESC
    `;

    return NextResponse.json(
      {
        followers: followerProfiles,
        count: followerProfiles.length,
      },
      {
        headers: { "Cache-Control": CACHE_POLICIES.publicListing.cacheControl },
      }
    );
  } catch (error) {
    console.error("Fetch followers error:", error);
    return NextResponse.json(
      { error: "Failed to fetch followers" },
      { status: 500 }
    );
  }
}
