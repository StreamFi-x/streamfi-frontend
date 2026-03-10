import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

/**
 * GET /api/streams/recordings?limit=20&offset=0&username=foo
 * Public endpoint — returns ready recordings.
 * Pass ?username= to filter to a specific user's recordings.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
    const username = searchParams.get("username") ?? "";

    const { rows } = username
      ? await sql`
          SELECT
            r.id,
            r.mux_asset_id,
            r.playback_id,
            r.title,
            r.duration,
            r.created_at,
            r.status,
            u.username,
            u.avatar,
            ss.started_at AS stream_date
          FROM stream_recordings r
          JOIN users u ON u.id = r.user_id
          LEFT JOIN stream_sessions ss ON ss.id = r.stream_session_id
          WHERE r.status = 'ready'
            AND LOWER(u.username) = LOWER(${username})
          ORDER BY r.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await sql`
          SELECT
            r.id,
            r.mux_asset_id,
            r.playback_id,
            r.title,
            r.duration,
            r.created_at,
            r.status,
            u.username,
            u.avatar,
            ss.started_at AS stream_date
          FROM stream_recordings r
          JOIN users u ON u.id = r.user_id
          LEFT JOIN stream_sessions ss ON ss.id = r.stream_session_id
          WHERE r.status = 'ready'
          ORDER BY r.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

    const { rows: countRows } = username
      ? await sql`
          SELECT COUNT(*) AS total
          FROM stream_recordings r
          JOIN users u ON u.id = r.user_id
          WHERE r.status = 'ready' AND LOWER(u.username) = LOWER(${username})
        `
      : await sql`
          SELECT COUNT(*) AS total FROM stream_recordings WHERE status = 'ready'
        `;
    const total = parseInt(countRows[0].total, 10);

    return NextResponse.json(
      {
        recordings: rows,
        total,
        hasMore: offset + limit < total,
        nextOffset: offset + limit < total ? offset + limit : null,
      },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("Error fetching public recordings:", error);
    return NextResponse.json(
      { error: "Failed to fetch recordings" },
      { status: 500 }
    );
  }
}
