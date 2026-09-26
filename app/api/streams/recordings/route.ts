import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { CACHE_POLICIES } from "@/lib/cache";
import {
  buildPage,
  keysetBounds,
  readPageParams,
  withoutCursorTs,
  type KeysetRow,
} from "@/lib/pagination/cursor";

/**
 * GET /api/streams/recordings?username=foo&limit=20&cursor=<nextCursor>
 * Public endpoint — returns ready recordings, newest first, on the shared
 * cursor contract (docs/api/pagination.md): { items, nextCursor, hasMore }.
 * Pass ?username= to filter to a specific user's recordings.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const params = readPageParams(searchParams, {
      defaultLimit: 20,
      maxLimit: 50,
    });
    if (!params.ok) {
      return params.response;
    }
    const { page } = params;
    const bound = keysetBounds(page.after);
    const username = searchParams.get("username") ?? "";

    const { rows } = username
      ? await sql<KeysetRow>`
          SELECT
            r.id,
            r.mux_asset_id,
            r.playback_id,
            r.title,
            r.duration,
            r.created_at,
            to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts,
            r.status,
            u.username,
            u.avatar,
            ss.started_at AS stream_date
          FROM stream_recordings r
          JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL
          LEFT JOIN stream_sessions ss ON ss.id = r.stream_session_id
          WHERE r.status = 'ready'
            AND LOWER(u.username) = LOWER(${username})
            AND (r.created_at, r.id) < (${bound.ts}::timestamptz, ${bound.id}::uuid)
          ORDER BY r.created_at DESC, r.id DESC
          LIMIT ${page.limit + 1}
        `
      : await sql<KeysetRow>`
          SELECT
            r.id,
            r.mux_asset_id,
            r.playback_id,
            r.title,
            r.duration,
            r.created_at,
            to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts,
            r.status,
            u.username,
            u.avatar,
            ss.started_at AS stream_date
          FROM stream_recordings r
          JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL
          LEFT JOIN stream_sessions ss ON ss.id = r.stream_session_id
          WHERE r.status = 'ready'
            AND (r.created_at, r.id) < (${bound.ts}::timestamptz, ${bound.id}::uuid)
          ORDER BY r.created_at DESC, r.id DESC
          LIMIT ${page.limit + 1}
        `;

    return NextResponse.json(buildPage(rows, page.limit, withoutCursorTs), {
      headers: {
        "Cache-Control": CACHE_POLICIES.publicListing.cacheControl,
      },
    });
  } catch (error) {
    console.error("Error fetching public recordings:", error);
    return NextResponse.json(
      { error: "Failed to fetch recordings" },
      { status: 500 }
    );
  }
}
