/**
 * GET /api/routes-f/analytics-viewer-geo (#1495)
 *
 * Returns viewer counts bucketed by country over the given range, for the
 * requesting channel owner's own streams. Reads from `stream_viewers`
 * (joined through `stream_sessions` to scope by channel), the same table
 * `country` is already recorded on at join time.
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

const MAX_RANGE_DAYS = 90;
const DEFAULT_RANGE_DAYS = 30;

const querySchema = z.object({
  channel: z.string().uuid(),
  days: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_RANGE_DAYS)
    .default(DEFAULT_RANGE_DAYS),
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
    const channelResult = await sql`
      SELECT id FROM users WHERE id = ${channel} LIMIT 1
    `;

    if (channelResult.rows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Only the channel owner may view their own viewer-geo breakdown.
    if (channel !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const geoResult = await sql<{
      country: string | null;
      viewer_count: number;
    }>`
      SELECT
        sv.country AS country,
        COUNT(DISTINCT COALESCE(sv.user_id::text, sv.session_id)) ::int AS viewer_count
      FROM stream_viewers sv
      JOIN stream_sessions ss ON ss.id = sv.stream_session_id
      WHERE ss.user_id = ${channel}
        AND sv.joined_at >= NOW() - (${days}::text || ' days')::interval
      GROUP BY sv.country
      ORDER BY viewer_count DESC
    `;

    const totalViewers = geoResult.rows.reduce(
      (sum, row) => sum + row.viewer_count,
      0
    );

    return NextResponse.json({
      channel,
      range_days: days,
      total_viewers: totalViewers,
      by_country: geoResult.rows.map(row => ({
        country: row.country ?? "unknown",
        viewer_count: row.viewer_count,
      })),
    });
  } catch (error) {
    console.error("[routes-f/analytics-viewer-geo] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
