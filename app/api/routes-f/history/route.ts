import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

/**
 * GET /api/routes-f/history?cursor=...&limit=20
 * Returns the viewer's watch history, cursor-paginated.
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const { userId } = session;
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor"); // ISO date string of last_seen_at
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  try {
    // Cursor-paginated query: most recent first
    const result = cursor
      ? await sql`
          SELECT 
            wh.stream_type,
            wh.stream_title,
            wh.last_seen_at as watched_at,
            wh.watch_seconds,
            wh.completed,
            u.username as streamer_username,
            u.avatar as streamer_avatar
          FROM watch_history wh
          JOIN users u ON u.id = wh.streamer_id
          WHERE wh.viewer_id = ${userId}
            AND wh.last_seen_at < ${cursor}
          ORDER BY wh.last_seen_at DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT 
            wh.stream_type,
            wh.stream_title,
            wh.last_seen_at as watched_at,
            wh.watch_seconds,
            wh.completed,
            u.username as streamer_username,
            u.avatar as streamer_avatar
          FROM watch_history wh
          JOIN users u ON u.id = wh.streamer_id
          WHERE wh.viewer_id = ${userId}
          ORDER BY wh.last_seen_at DESC
          LIMIT ${limit}
        `;

    const history = result.rows.map((row) => ({
      streamer: {
        username: row.streamer_username,
        avatar: row.streamer_avatar,
      },
      stream_type: row.stream_type,
      stream_title: row.stream_title || (row.stream_type === "live" ? "Live Stream" : "Untitled Recording"),
      watched_at: row.watched_at,
      watch_seconds: row.watch_seconds,
      completed: row.completed,
    }));

    const nextCursor =
      result.rows.length === limit
        ? result.rows[result.rows.length - 1].watched_at
        : null;

    return NextResponse.json({
      history,
      next_cursor: nextCursor,
    });
  } catch (error) {
    console.error("[history] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/routes-f/history
 * Clears the watch history for the current viewer.
 */
export async function DELETE(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const { userId } = session;

  try {
    await sql`
      DELETE FROM watch_history
      WHERE viewer_id = ${userId}
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[history] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
