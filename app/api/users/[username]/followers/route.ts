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
    const { rows } = await sql`
      SELECT followers FROM users WHERE username = ${username}
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const followerUsernames = rows[0].followers || [];
    if (followerUsernames.length === 0) {
      return NextResponse.json({ followers: [] });
    }

    const { rows: followerProfiles } = await sql`
      SELECT username, avatar, bio FROM users WHERE username = ANY(${followerUsernames})
    `;
    return NextResponse.json({ followers: followerProfiles });
  } catch (error) {
    console.error("Fetch followers error:", error);
    return NextResponse.json(
      { error: "Failed to fetch followers" },
      { status: 500 }
    );
  }
}
