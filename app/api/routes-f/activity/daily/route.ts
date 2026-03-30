import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { ensureActivitySchema } from "../_lib/db";
import type { DailySummaryResponse } from "@/types/activity";

const dailyQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format")
    .refine(
      (v) => !isNaN(new Date(`${v}T00:00:00Z`).getTime()),
      "date must be a valid calendar date",
    ),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const queryResult = validateQuery(
    req.nextUrl.searchParams,
    dailyQuerySchema,
  );
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { date } = queryResult.data;
  const start = `${date}T00:00:00Z`;
  const end = `${date}T23:59:59.999Z`;

  try {
    await ensureActivitySchema();

    const { rows } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE type = 'tip_received')::int
          AS tips_received,
        COALESCE(SUM((metadata->>'amount')::numeric)
          FILTER (WHERE type = 'tip_received'), 0)::text
          AS tips_received_xlm,
        COUNT(*) FILTER (WHERE type = 'new_follower')::int
          AS followers_gained,
        COALESCE(SUM((metadata->>'duration_s')::int)
          FILTER (WHERE type = 'stream_ended'), 0)::int
          AS stream_duration_s,
        COALESCE(MAX((metadata->>'peak_viewers')::int)
          FILTER (WHERE type = 'stream_ended'), 0)::int
          AS peak_viewers
      FROM route_f_activity_events
      WHERE user_id = ${session.userId}
        AND created_at >= ${start}
        AND created_at <= ${end}
    `;

    const row = rows[0];

    const body: DailySummaryResponse = {
      date,
      tips_received: row.tips_received ?? 0,
      tips_received_xlm: row.tips_received_xlm ?? "0",
      followers_gained: row.followers_gained ?? 0,
      stream_duration_s: row.stream_duration_s ?? 0,
      peak_viewers: row.peak_viewers ?? 0,
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[activity/daily] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
