import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const normalizedUsername = username.toLowerCase();
    const { searchParams } = new URL(req.url);
    const viewerUsername = searchParams.get("viewer_username") ?? "";

    const result = await sql`
      SELECT
        u.id, u.username, u.wallet, u.avatar, u.banner, u.bio,
        u.sociallinks, u.emailverified, u.emailnotifications,
        u.creator, u.auth_type, u.privy_id,
        u.is_live, u.mux_playback_id, u.latency_mode, u.current_viewers,
        u.stream_started_at, u.total_views,
        u.total_tips_received, u.total_tips_count, u.last_tip_at,
        u.created_at, u.updated_at,
        (u.stream_password_hash IS NOT NULL) AS is_password_protected,
        (SELECT COUNT(*)::int FROM user_follows WHERE followee_id = u.id) AS follower_count,
        (SELECT COUNT(*)::int FROM user_follows WHERE follower_id = u.id) AS following_count,
        EXISTS(
          SELECT 1 FROM user_follows uf
          JOIN users viewer ON viewer.id = uf.follower_id
          WHERE LOWER(viewer.username) = LOWER(${viewerUsername})
            AND uf.followee_id = u.id
        ) AS is_following
      FROM users u
      WHERE LOWER(u.username) = ${normalizedUsername}
    `;

    const user = result.rows[0];

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Strip internal/private fields before sending to any client
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { privy_id, email, ...publicUser } = user;

    return NextResponse.json(
      { user: publicUser },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("API: Fetch user error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
