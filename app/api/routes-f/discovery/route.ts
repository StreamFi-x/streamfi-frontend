import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { ensureRoutesFSchema } from "../_lib/schema";

/**
 * GET /api/routes-f/discovery
 * Query params: ?type=trending|rising|featured&limit=20&cursor=
 */
export async function GET(req: NextRequest) {
  try {
    await ensureRoutesFSchema();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "trending";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const cursor = searchParams.get("cursor") || null;

    let query;
    if (type === "trending") {
      // Trending: Scored by viewer count + recency (time-decay)
      // Score = viewers * exp(-decay_factor * hours_since_start)
      query = sql`
        SELECT 
          u.id, u.username, u.avatar, u.is_live, u.current_viewers, u.stream_started_at,
          (u.current_viewers * EXP(-0.1 * EXTRACT(EPOCH FROM (NOW() - u.stream_started_at)) / 3600)) as score
        FROM users u
        WHERE u.is_live = true
        ${cursor ? sql`AND (u.current_viewers * EXP(-0.1 * EXTRACT(EPOCH FROM (NOW() - u.stream_started_at)) / 3600)) < (
          SELECT (u2.current_viewers * EXP(-0.1 * EXTRACT(EPOCH FROM (NOW() - u2.stream_started_at)) / 3600))
          FROM users u2 WHERE u2.id = ${cursor}
        )` : sql``}
        ORDER BY score DESC, u.id DESC
        LIMIT ${limit}
      `;
    } else if (type === "rising") {
      // Rising: highest viewer growth in last 60 min
      // We count viewers who joined in the last 60 mins for currently active sessions
      query = sql`
        SELECT 
          u.id, u.username, u.avatar, u.is_live, u.current_viewers,
          COUNT(sv.id) as growth_score
        FROM users u
        JOIN stream_sessions ss ON u.id = ss.user_id AND ss.ended_at IS NULL
        LEFT JOIN stream_viewers sv ON ss.id = sv.stream_session_id AND sv.joined_at > NOW() - INTERVAL '60 minutes'
        WHERE u.is_live = true
        GROUP BY u.id
        ${cursor ? sql`HAVING COUNT(sv.id) <= (
          SELECT COUNT(sv2.id)
          FROM stream_sessions ss2
          LEFT JOIN stream_viewers sv2 ON ss2.id = sv2.stream_session_id AND sv2.joined_at > NOW() - INTERVAL '60 minutes'
          WHERE ss2.user_id = ${cursor} AND ss2.ended_at IS NULL
        )` : sql``}
        ORDER BY growth_score DESC, u.id DESC
        LIMIT ${limit}
      `;
    } else if (type === "featured") {
      // Featured: manually curated list
      query = sql`
        SELECT u.id, u.username, u.avatar, u.is_live, u.current_viewers, u.is_featured
        FROM users u
        WHERE u.is_featured = true
        ${cursor ? sql`AND u.id < ${cursor}` : sql``}
        ORDER BY u.created_at DESC, u.id DESC
        LIMIT ${limit}
      `;
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const { rows } = await query;
    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

    return NextResponse.json({
      data: rows,
      next_cursor: nextCursor
    });
  } catch (error) {
    console.error("Discovery error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
