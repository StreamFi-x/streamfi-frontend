import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { uuidSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { ensureAnalyticsSchema } from "./_lib/db";

const createWatchEventSchema = z.object({
  stream_id: uuidSchema,
  duration_seconds: z.number().int().min(1).max(86400),
  category: z.string().trim().min(1).max(80),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensureAnalyticsSchema();

    const [
      summaryResult,
      topCategoriesResult,
      topStreamsResult,
      dailyResult,
      weeklyResult,
      monthlyResult,
    ] = await Promise.all([
      sql`
        SELECT
          COALESCE(SUM(duration_seconds), 0)::int AS total_watch_time,
          COUNT(*)::int AS sessions_count
        FROM route_f_watch_events
        WHERE user_id = ${session.userId}
      `,
      sql`
        SELECT
          category,
          COALESCE(SUM(duration_seconds), 0)::int AS watch_time,
          COUNT(*)::int AS sessions
        FROM route_f_watch_events
        WHERE user_id = ${session.userId}
        GROUP BY category
        ORDER BY watch_time DESC, sessions DESC, category ASC
        LIMIT 5
      `,
      sql`
        SELECT
          e.stream_id,
          u.username,
          u.avatar,
          COALESCE(SUM(e.duration_seconds), 0)::int AS watch_time,
          COUNT(*)::int AS sessions
        FROM route_f_watch_events e
        JOIN users u ON u.id = e.stream_id
        WHERE e.user_id = ${session.userId}
        GROUP BY e.stream_id, u.username, u.avatar
        ORDER BY watch_time DESC, sessions DESC, u.username ASC
        LIMIT 5
      `,
      sql`
        SELECT
          TO_CHAR(date_trunc('day', watched_at), 'YYYY-MM-DD') AS bucket,
          COALESCE(SUM(duration_seconds), 0)::int AS watch_time,
          COUNT(*)::int AS sessions
        FROM route_f_watch_events
        WHERE user_id = ${session.userId}
        GROUP BY date_trunc('day', watched_at)
        ORDER BY date_trunc('day', watched_at) DESC
        LIMIT 30
      `,
      sql`
        SELECT
          TO_CHAR(date_trunc('week', watched_at), 'YYYY-MM-DD') AS bucket,
          COALESCE(SUM(duration_seconds), 0)::int AS watch_time,
          COUNT(*)::int AS sessions
        FROM route_f_watch_events
        WHERE user_id = ${session.userId}
        GROUP BY date_trunc('week', watched_at)
        ORDER BY date_trunc('week', watched_at) DESC
        LIMIT 12
      `,
      sql`
        SELECT
          TO_CHAR(date_trunc('month', watched_at), 'YYYY-MM') AS bucket,
          COALESCE(SUM(duration_seconds), 0)::int AS watch_time,
          COUNT(*)::int AS sessions
        FROM route_f_watch_events
        WHERE user_id = ${session.userId}
        GROUP BY date_trunc('month', watched_at)
        ORDER BY date_trunc('month', watched_at) DESC
        LIMIT 12
      `,
    ]);

    const summary = summaryResult.rows[0] ?? {
      total_watch_time: 0,
      sessions_count: 0,
    };

    return NextResponse.json({
      total_watch_time: summary.total_watch_time,
      sessions_count: summary.sessions_count,
      top_categories: topCategoriesResult.rows,
      top_streams: topStreamsResult.rows,
      watch_time_by_period: {
        day: dailyResult.rows,
        week: weeklyResult.rows,
        month: monthlyResult.rows,
      },
    });
  } catch (error) {
    console.error("[analytics] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, createWatchEventSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { stream_id, duration_seconds, category } = bodyResult.data;

  try {
    await ensureAnalyticsSchema();

    const { rows: streamRows } = await sql`
      SELECT id FROM users WHERE id = ${stream_id} LIMIT 1
    `;

    if (streamRows.length === 0) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    const { rows } = await sql`
      INSERT INTO route_f_watch_events (
        user_id,
        stream_id,
        duration_seconds,
        category
      )
      VALUES (
        ${session.userId},
        ${stream_id},
        ${duration_seconds},
        ${category}
      )
      RETURNING id, user_id, stream_id, duration_seconds, category, watched_at
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("[analytics] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
