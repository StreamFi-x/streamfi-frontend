import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import {
  CACHE_POLICIES,
  cacheHeaders,
  cacheKey,
  cacheTags,
  cached,
} from "@/lib/cache";

async function loadPublicProfile(normalizedUsername: string) {
  const result = await sql`
    SELECT
      u.id, u.username, u.wallet, u.avatar, u.banner, u.bio,
      u.sociallinks, u.emailverified, u.emailnotifications,
      u.creator, u.auth_type,
      u.is_live, u.mux_playback_id, u.latency_mode, u.current_viewers,
      COALESCE(u.stream_access_type, 'public') AS stream_access_type,
      COALESCE(
        NULLIF(u.creator->>'subscriptionPrice', '')::numeric,
        NULLIF(u.creator->>'subscription_price_usdc', '')::numeric
      ) AS subscription_price_usdc,
      u.stream_started_at, u.total_views,
      u.total_tips_received, u.total_tips_count, u.last_tip_at,
      u.created_at, u.updated_at,
      (u.stream_password_hash IS NOT NULL) AS is_password_protected,
      (SELECT COUNT(*)::int FROM user_follows f
         JOIN users fu ON fu.id = f.follower_id AND fu.deleted_at IS NULL
         WHERE f.followee_id = u.id) AS follower_count,
      (SELECT COUNT(*)::int FROM user_follows f
         JOIN users fu ON fu.id = f.followee_id AND fu.deleted_at IS NULL
         WHERE f.follower_id = u.id) AS following_count
    FROM users u
    WHERE LOWER(u.username) = ${normalizedUsername} AND u.deleted_at IS NULL
  `;
  return result.rows[0] ?? null;
}

async function isFollowing(viewerUsername: string, userId: string) {
  const result = await sql`
    SELECT EXISTS(
      SELECT 1 FROM user_follows uf
      JOIN users viewer ON viewer.id = uf.follower_id
      WHERE LOWER(viewer.username) = LOWER(${viewerUsername})
        AND viewer.deleted_at IS NULL
        AND uf.followee_id = ${userId}
    ) AS is_following
  `;
  return Boolean(result.rows[0]?.is_following);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const normalizedUsername = username.toLowerCase();
    const { searchParams } = new URL(req.url);
    const viewerUsername = searchParams.get("viewer_username") ?? "";

    // The viewer-independent part is cached and invalidated by every write to
    // the row (lib/cache/invalidation.ts); is_following is per viewer, so it is
    // always read live.
    const user = await cached(
      {
        key: cacheKey("user-profile", normalizedUsername),
        tags: [cacheTags.userByName(normalizedUsername)],
        ttlSeconds: CACHE_POLICIES.publicProfile.appTtlSeconds,
      },
      () => loadPublicProfile(normalizedUsername)
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const is_following = viewerUsername
      ? await isFollowing(viewerUsername, user.id)
      : false;

    return NextResponse.json(
      { user: { ...user, is_following } },
      { headers: cacheHeaders("publicProfile") }
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
