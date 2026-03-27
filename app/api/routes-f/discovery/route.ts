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

    let rows: any[] = [];
    if (type === "trending") {
      // Trending: Scored by viewer count + recency (score decay)
      const res = await sql`
        SELECT 
          id, username, avatar, is_live, current_viewers, stream_started_at,
          (current_viewers * EXP(-0.1 * EXTRACT(EPOCH FROM (NOW() - stream_started_at)) / 3600)) as score
        FROM users
        WHERE is_live = true
        ORDER BY score DESC, id DESC
        LIMIT ${limit}
      `;
      rows = res.rows;
      
      // Simple cursor filtering after query for composite scores since it's hard to filter on calculated score in one go with the cursor being an ID
      if (cursor) {
        const cursorIndex = rows.findIndex((r: any) => r.id === cursor);
        if (cursorIndex !== -1) {
          rows = rows.slice(cursorIndex + 1);
        }
      }
    } else if (type === "rising") {
      // Rising: highest viewer growth in last 60 min
      const res = await sql`
        SELECT 
          u.id, u.username, u.avatar, u.is_live, u.current_viewers,
          (SELECT COUNT(*)::int 
           FROM stream_viewers sv 
           JOIN stream_sessions ss ON sv.stream_session_id = ss.id 
           WHERE ss.user_id = u.id AND ss.ended_at IS NULL AND sv.joined_at > NOW() - INTERVAL '60 minutes') as growth_score
        FROM users u
        WHERE u.is_live = true
        ORDER BY growth_score DESC, u.id DESC
        LIMIT ${limit}
      `;
      rows = res.rows;

      if (cursor) {
        const cursorIndex = rows.findIndex((r: any) => r.id === cursor);
        if (cursorIndex !== -1) {
          rows = rows.slice(cursorIndex + 1);
        }
      }
    } else if (type === "featured") {
      // Featured: manually curated creators
      const res = await sql`
        SELECT id, username, avatar, is_live, current_viewers, is_featured
        FROM users
        WHERE is_featured = true
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit}
      `;
      rows = res.rows;

      if (cursor) {
        const cursorIndex = rows.findIndex((r: any) => r.id === cursor);
        if (cursorIndex !== -1) {
          rows = rows.slice(cursorIndex + 1);
        }
      }
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

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
