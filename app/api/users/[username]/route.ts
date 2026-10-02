import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { canAccessStream } from "@/lib/stream-access";
import { hasStreamPasswordGrant } from "@/lib/stream-password";
import { verifySession } from "@/lib/auth/verify-session";
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
  req: NextRequest,
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
        u.stream_privacy, u.share_token,
        u.stream_password_hash,
        (SELECT id FROM stream_sessions ss WHERE ss.user_id = u.id AND ss.ended_at IS NULL ORDER BY ss.started_at DESC LIMIT 1) AS stream_session_id,
        u.created_at, u.updated_at,
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

    // Resolve viewer's user id so we can do owner/subscription checks
    let viewerUserId: string | null = null;
    if (viewerUsername) {
      const viewer = await sql`
        SELECT id FROM users WHERE LOWER(username) = LOWER(${viewerUsername})
      `;
      viewerUserId = viewer.rows[0]?.id ?? null;
    }
    const verifiedViewer = await verifySession(req);
    const verifiedViewerId = verifiedViewer.ok ? verifiedViewer.userId : null;

    const access = await canAccessStream({
      privacy: user.stream_privacy,
      streamShareToken: user.share_token,
      providedToken,
      creatorUserId: user.id,
      viewerUserId,
    });
    if (access.allowed && user.stream_password_hash && user.id !== verifiedViewerId &&
        (!user.stream_session_id || !hasStreamPasswordGrant(req, user.id, user.stream_session_id))) {
      access.allowed = false;
      access.reason = "password_required";
    }

    // Strip private/internal fields before sending to any client
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { privy_id, email, share_token, stream_password_hash, stream_session_id, ...publicUser } = user;

    // For private streams without access: hide the playback id and current_viewers
    if (!access.allowed) {
      publicUser.mux_playback_id = null;
      publicUser.is_live = false; // hide live status to prevent traffic spikes from URL leaks
      publicUser.current_viewers = 0;
      publicUser.stream_started_at = null;
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
