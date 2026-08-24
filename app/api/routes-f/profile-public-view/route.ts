import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams
    .get("username")
    ?.trim()
    .toLowerCase();

  if (!username) {
    return NextResponse.json(
      { error: "username is required" },
      { status: 400 }
    );
  }

  try {
    const { rows } = await sql`
      SELECT
        username as handle, 
        avatar, 
        banner, 
        bio, 
        sociallinks as socials
      FROM users
      WHERE LOWER(username) = ${username}
      LIMIT 1
    `;
    const user = rows[0];

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        handle: user.handle,
        avatar: user.avatar ?? null,
        banner: user.banner ?? null,
        bio: user.bio ?? "",
        socials: Array.isArray(user.socials) ? user.socials : [],
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("[routes-f/profile-public-view] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch public profile" },
      { status: 500 }
    );
  }
}
