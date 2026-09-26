import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

interface Recommendation {
  stream_id: string | null;
  stream_type: string;
  stream_title: string;
  streamer_username: string;
  streamer_avatar: string | null;
  streamer_id: string;
  last_watched_at: string;
  watch_seconds: number;
  reason: "continue_watching" | "recommended";
}

/**
 * GET /api/routes-f/recommendations
 * Returns personalized recommendations based on watch history:
 * 1. Continue Watching: Recently watched VODs/clips that can be resumed
 * 2. Recommended: Streams from creators user has watched, sorted by recency and completion
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const { userId } = session;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const continueWatchingLimit = Math.min(10, Math.max(1, parseInt(searchParams.get("continue_limit") ?? "5", 10)));

  try {
    // 1. Continue Watching: Recent streams that can be resumed (VOD/clip, not completed, from last 7 days)
    const continueWatchingResult = await sql`
      SELECT 
        wh.stream_id,
        wh.stream_type,
        wh.stream_title,
        u.username as streamer_username,
        u.avatar as streamer_avatar,
        u.id as streamer_id,
        wh.last_seen_at as last_watched_at,
        wh.watch_seconds,
        'continue_watching' as reason
      FROM watch_history wh
      JOIN users u ON u.id = wh.streamer_id AND u.deleted_at IS NULL
      WHERE wh.viewer_id = ${userId}
        AND wh.stream_type IN ('vod', 'clip')
        AND wh.completed = false
        AND wh.last_seen_at > NOW() - INTERVAL '7 days'
      ORDER BY wh.last_seen_at DESC
      LIMIT ${continueWatchingLimit}
    `;

    // 2. Recommended: Recent streams from creators user has watched (last 30 days)
    const recommendedResult = await sql`
      SELECT DISTINCT
        wh.stream_id,
        wh.stream_type,
        wh.stream_title,
        u.username as streamer_username,
        u.avatar as streamer_avatar,
        u.id as streamer_id,
        wh.last_seen_at as last_watched_at,
        wh.watch_seconds,
        'recommended' as reason,
        ROW_NUMBER() OVER (PARTITION BY wh.streamer_id ORDER BY wh.last_seen_at DESC) as recency_rank
      FROM watch_history wh
      JOIN users u ON u.id = wh.streamer_id AND u.deleted_at IS NULL
      WHERE wh.viewer_id = ${userId}
        AND wh.started_at > NOW() - INTERVAL '30 days'
      ORDER BY u.id, wh.last_seen_at DESC
    `;

    // Filter recommended results to 1 per creator, then slice to limit
    const recommendedByCreator = new Map<string, Recommendation>();
    for (const row of recommendedResult.rows as any[]) {
      if (row.recency_rank === 1 && recommendedByCreator.size < (limit - continueWatchingResult.rows.length)) {
        recommendedByCreator.set(row.streamer_id, {
          stream_id: row.stream_id,
          stream_type: row.stream_type,
          stream_title: row.stream_title,
          streamer_username: row.streamer_username,
          streamer_avatar: row.streamer_avatar,
          streamer_id: row.streamer_id,
          last_watched_at: row.last_watched_at,
          watch_seconds: row.watch_seconds,
          reason: "recommended",
        });
      }
    }

    const continueWatching: Recommendation[] = (continueWatchingResult.rows as any[]).map((row) => ({
      stream_id: row.stream_id,
      stream_type: row.stream_type,
      stream_title: row.stream_title,
      streamer_username: row.streamer_username,
      streamer_avatar: row.streamer_avatar,
      streamer_id: row.streamer_id,
      last_watched_at: row.last_watched_at,
      watch_seconds: row.watch_seconds,
      reason: "continue_watching",
    }));

    const recommendations: Recommendation[] = [
      ...continueWatching,
      ...Array.from(recommendedByCreator.values()),
    ].slice(0, limit);

    return NextResponse.json({
      recommendations,
      continue_watching_count: continueWatching.length,
      recommended_count: recommendedByCreator.size,
    });
  } catch (error) {
    console.error("[recommendations] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
