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
        id, username, avatar, banner, bio, sociallinks,
        is_live, creator, mux_playback_id, total_views, total_tips_count,
        followers, following
      FROM users
      WHERE LOWER(username) = ${username}
      LIMIT 1
    `;
    const user = rows[0];

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const creatorData = (user.creator ?? {}) as Record<string, unknown>;

    const followerCountPromise = sql`
      SELECT COUNT(*)::int AS count
      FROM user_follows
      WHERE followee_id = ${user.id}
    `
      .then(result => result.rows[0]?.count ?? 0)
      .catch(() => {
        const rawFollowers = Array.isArray(user.followers)
          ? user.followers
          : [];
        return rawFollowers.length;
      });

    const followingCountPromise = sql`
      SELECT COUNT(*)::int AS count
      FROM user_follows
      WHERE follower_id = ${user.id}
    `
      .then(result => result.rows[0]?.count ?? 0)
      .catch(() => {
        const rawFollowing = Array.isArray(user.following)
          ? user.following
          : [];
        return rawFollowing.length;
      });

    const streamStatsPromise = sql`
      SELECT
        COUNT(*)::int AS total_streams,
        COALESCE(SUM(COALESCE(duration_seconds, 0)), 0)::int AS total_duration_seconds
      FROM stream_sessions
      WHERE user_id = ${user.id}
    `;

    const recentStreamsPromise = sql`
      SELECT id, title, playback_id, COALESCE(duration, 0)::int AS duration_seconds, created_at
      FROM stream_recordings
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 5
    `
      .then(result => result.rows)
      .catch(() => []);

    const topClipsPromise = sql`
      SELECT id, title, playback_id, duration, view_count, created_at
      FROM stream_clips
      WHERE streamer_id = ${user.id} AND status = 'ready'
      ORDER BY view_count DESC, created_at DESC
      LIMIT 5
    `
      .then(result => result.rows)
      .catch(() => []);

    const [
      followerCount,
      followingCount,
      streamStats,
      recentStreams,
      topClips,
    ] = await Promise.all([
      followerCountPromise,
      followingCountPromise,
      streamStatsPromise,
      recentStreamsPromise,
      topClipsPromise,
    ]);

    const recentStreamItems = recentStreams.map(stream => ({
      id: stream.id,
      title: stream.title ?? "Untitled Stream",
      playback_id: stream.playback_id,
      duration_seconds: Number(stream.duration_seconds ?? 0),
      views: 0,
      created_at: stream.created_at,
    }));

    const categories: string[] = Array.isArray(creatorData.categories)
      ? (creatorData.categories as string[])
      : typeof creatorData.category === "string"
        ? [creatorData.category]
        : [];

    const tags: string[] = Array.isArray(creatorData.tags)
      ? (creatorData.tags as string[])
      : [];

    const statsRow = streamStats.rows[0] ?? {
      total_streams: 0,
      total_duration_seconds: 0,
    };

    return NextResponse.json(
      {
        username: user.username,
        avatar: user.avatar ?? null,
        banner: user.banner ?? null,
        bio: user.bio ?? "",
        is_live: Boolean(user.is_live),
        stream_title:
          typeof creatorData.streamTitle === "string"
            ? creatorData.streamTitle
            : "Live Stream",
        social_links: Array.isArray(user.sociallinks) ? user.sociallinks : [],
        stats: {
          followers: Number(followerCount ?? 0),
          following: Number(followingCount ?? 0),
          total_streams: Number(statsRow.total_streams ?? 0),
          total_hours_streamed: Math.floor(
            Number(statsRow.total_duration_seconds ?? 0) / 3600
          ),
          total_views: Number(user.total_views ?? 0),
          tips_received_count: Number(user.total_tips_count ?? 0),
        },
        recent_streams: recentStreamItems,
        top_clips: topClips,
        categories,
        tags,
        stream_access_type:
          typeof creatorData.streamAccessType === "string"
            ? creatorData.streamAccessType
            : "public",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("[routes-f/profile] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}
