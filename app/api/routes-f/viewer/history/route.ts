import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session.ok) {
    return session.response;
  }

  try {
    // Respect privacy setting
    const { rows: privacyRows } = await sql`
      SELECT show_watch_history FROM user_privacy_settings WHERE user_id = ${session.userId} LIMIT 1
    `;
    if (privacyRows[0]?.show_watch_history === false) {
      return NextResponse.json(
        { error: "Watch history is disabled for this account" },
        { status: 403 }
      );
    }

    const params = request.nextUrl.searchParams;
    const cursor = params.get("cursor") ?? null;
    const limitRaw = Number(params.get("limit") ?? DEFAULT_LIMIT);
    const limit = Math.min(Math.max(1, limitRaw), MAX_LIMIT);

    const { rows } = cursor
      ? await sql`
          SELECT
            wh.id,
            wh.stream_id,
            u.username        AS creator_username,
            wh.watched_at,
            wh.watch_duration_seconds,
            s.thumbnail_url
          FROM watch_history wh
          JOIN streams s ON s.id = wh.stream_id
          JOIN users u   ON u.id = s.creator_id
          WHERE wh.user_id = ${session.userId}
            AND wh.watched_at < (SELECT watched_at FROM watch_history WHERE id = ${cursor} LIMIT 1)
          ORDER BY wh.watched_at DESC
          LIMIT ${limit + 1}
        `
      : await sql`
          SELECT
            wh.id,
            wh.stream_id,
            u.username        AS creator_username,
            wh.watched_at,
            wh.watch_duration_seconds,
            s.thumbnail_url
          FROM watch_history wh
          JOIN streams s ON s.id = wh.stream_id
          JOIN users u   ON u.id = s.creator_id
          WHERE wh.user_id = ${session.userId}
          ORDER BY wh.watched_at DESC
          LIMIT ${limit + 1}
        `;

    const hasMore = rows.length > limit;
    const entries = rows.slice(0, limit);

    return NextResponse.json({
      entries,
      nextCursor: hasMore ? entries[entries.length - 1].id : null,
    });
  } catch (error) {
    console.error("[routes-f viewer/history GET]", error);
    return NextResponse.json({ error: "Failed to fetch watch history" }, { status: 500 });
  }
}
