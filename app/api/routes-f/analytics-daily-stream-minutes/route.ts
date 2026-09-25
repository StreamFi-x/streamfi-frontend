import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { ensureDailyStreamMinutesDependencies } from "./_lib/db";

const MAX_RANGE_DAYS = 90;
const DEFAULT_RANGE_DAYS = 30;

const querySchema = z.object({
  channel: z.string().uuid(),
  days: z.coerce.number().int().min(1).max(MAX_RANGE_DAYS).default(DEFAULT_RANGE_DAYS),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const queryResult = await validateQuery(req, querySchema);
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { channel, days } = queryResult.data;

  try {
    await ensureDailyStreamMinutesDependencies();

    const channelResult = await sql`
      SELECT id FROM users WHERE id = ${channel} LIMIT 1
    `;

    if (channelResult.rows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Only the channel owner may view their own stream-minutes breakdown.
    if (channel !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const dailyResult = await sql<{
      bucket: string;
      minutes_streamed: number;
      sessions: number;
    }>`
      SELECT
        TO_CHAR(date_trunc('day', started_at), 'YYYY-MM-DD') AS bucket,
        ROUND(COALESCE(SUM(duration_seconds), 0) / 60.0)::int AS minutes_streamed,
        COUNT(*)::int AS sessions
      FROM route_f_broadcast_sessions
      WHERE creator_id = ${channel}
        AND started_at >= NOW() - (${days}::text || ' days')::interval
      GROUP BY date_trunc('day', started_at)
      ORDER BY date_trunc('day', started_at) ASC
    `;

    return NextResponse.json({
      channel,
      range_days: days,
      daily_stream_minutes: dailyResult.rows,
    });
  } catch (error) {
    console.error("[routes-f/analytics-daily-stream-minutes] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
