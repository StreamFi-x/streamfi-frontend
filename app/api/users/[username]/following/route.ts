import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET(
  req: NextRequest,
  { params }: { params: { username: string } }
) {
  const { username } = params;

  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  try {
    const { rows } = await sql`
      SELECT following FROM users WHERE username = ${username}
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const followingUsernames = rows[0].following || [];
    if (followingUsernames.length === 0) {
      return NextResponse.json({ following: [] });
    }

    const { rows: followingProfiles } = await sql`
      SELECT username, avatar, bio FROM users WHERE username = ANY(${followingUsernames})
    `;
    return NextResponse.json({ following: followingProfiles });
  } catch (error) {
    console.error("Fetch following error:", error);
    return NextResponse.json(
      { error: "Failed to fetch following" },
      { status: 500 }
    );
  }
}
