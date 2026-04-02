import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { usernameSchema } from "@/app/api/routes-f/_lib/schemas";
import { getOptionalSession } from "@/app/api/routes-f/_lib/session";

// ────────────────────────────────────────────────────────────────
// Schema
// ────────────────────────────────────────────────────────────────

const metricsQuerySchema = z.object({
  username: usernameSchema,
  period: z.enum(["7d", "30d", "90d"], {
    errorMap: () => ({ message: "period must be one of: 7d, 30d, 90d" }),
  }),
});

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function periodToDays(period: string): number {
  switch (period) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    default:
      return 30;
  }
}

// ────────────────────────────────────────────────────────────────
// GET /api/routes-f/metrics?username={username}&period=7d|30d|90d
// Returns aggregated metrics for a creator's streams within
// the requested period.
//
// Public metrics (stream counts, viewer counts) available to all.
// Financial metrics (tips) only returned to the stream owner.
// ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, metricsQuerySchema);
  if (queryResult instanceof NextResponse) {return queryResult;}

  const { username, period } = queryResult.data;
  const days = periodToDays(period);

  try {
    // ────────────────────────────────────────────────────────────
    // 1. Look up the creator
    // ────────────────────────────────────────────────────────────
    const { rows: userRows } = await sql`
      SELECT id, username
      FROM users
      WHERE LOWER(username) = LOWER(${username})
      LIMIT 1
    `;

    if (userRows.length === 0) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const creator = userRows[0];

    // ────────────────────────────────────────────────────────────
    // 2. Check if requester is the stream owner (for financial data)
    // ────────────────────────────────────────────────────────────
    const session = await getOptionalSession(req);
    const isOwner = session?.userId === creator.id;

    // ────────────────────────────────────────────────────────────
    // 3. Fetch all metrics in parallel
    // ────────────────────────────────────────────────────────────
    const [streamStats, viewerStats, tipStats, recordingStats, topStream] =
      await Promise.all([
        // Stream stats
        sql<{
          total: number;
          total_duration_minutes: string;
          avg_duration_minutes: string;
        }>`
          SELECT
            COUNT(*)::int AS total,
            COALESCE(SUM(duration_seconds) / 60, 0)::numeric(10,0)::text AS total_duration_minutes,
            COALESCE(AVG(duration_seconds) / 60, 0)::numeric(10,0)::text AS avg_duration_minutes
          FROM stream_sessions
          WHERE user_id = ${creator.id}
            AND started_at >= NOW() - (${days} || ' days')::interval
        `,

        // Viewer stats
        sql<{
          total_unique: number;
          peak_concurrent: number;
          avg_concurrent: string;
        }>`
          SELECT
            COALESCE(SUM(ss.total_unique_viewers), 0)::int AS total_unique,
            COALESCE(MAX(ss.peak_viewers), 0)::int AS peak_concurrent,
            COALESCE(AVG(ss.peak_viewers), 0)::numeric(10,0)::text AS avg_concurrent
          FROM stream_sessions ss
          WHERE ss.user_id = ${creator.id}
            AND ss.started_at >= NOW() - (${days} || ' days')::interval
        `,

        // Tip stats (only queried if owner, but we run concurrently)
        isOwner
          ? sql<{
              total_xlm: string;
              total_usdc: string;
              tip_count: number;
            }>`
              SELECT
                COALESCE(SUM(CASE WHEN currency = 'XLM' THEN amount ELSE 0 END), 0)::numeric(20,2)::text AS total_xlm,
                COALESCE(SUM(CASE WHEN currency = 'USDC' THEN amount ELSE 0 END), 0)::numeric(20,2)::text AS total_usdc,
                COUNT(*)::int AS tip_count
              FROM tip_transactions
              WHERE creator_id = ${creator.id}
                AND created_at >= NOW() - (${days} || ' days')::interval
            `
          : Promise.resolve({ rows: [] }),

        // Recording stats
        sql<{
          total_views: number;
          total_ready: number;
        }>`
          SELECT
            COALESCE(SUM(
              CASE WHEN sr.status = 'ready' THEN 1 ELSE 0 END
            ), 0)::int AS total_ready,
            0::int AS total_views
          FROM stream_recordings sr
          WHERE sr.user_id = ${creator.id}
            AND sr.created_at >= NOW() - (${days} || ' days')::interval
        `,

        // Top stream in period
        sql<{
          title: string | null;
          peak_viewers: number;
          date: string;
        }>`
          SELECT
            COALESCE(ss.title, 'Untitled Stream') AS title,
            COALESCE(ss.peak_viewers, 0)::int AS peak_viewers,
            to_char(ss.started_at, 'YYYY-MM-DD') AS date
          FROM stream_sessions ss
          WHERE ss.user_id = ${creator.id}
            AND ss.started_at >= NOW() - (${days} || ' days')::interval
          ORDER BY ss.peak_viewers DESC NULLS LAST
          LIMIT 1
        `,
      ]);

    // ────────────────────────────────────────────────────────────
    // 4. Build response
    // ────────────────────────────────────────────────────────────
    const sRow = streamStats.rows[0];
    const vRow = viewerStats.rows[0];
    const rRow = recordingStats.rows[0];
    const tRow = topStream.rows[0];

    const tipRow = tipStats.rows[0] ?? null;
    const totalXlm = tipRow ? Number(tipRow.total_xlm) : 0;
    const totalUsdc = tipRow ? Number(tipRow.total_usdc) : 0;
    // Rough USD equivalent: XLM ≈ $0.09 (placeholder), USDC = $1.00
    const totalUsdEquivalent = (totalXlm * 0.09 + totalUsdc).toFixed(2);

    const response: Record<string, unknown> = {
      period,
      streams: {
        total: sRow?.total ?? 0,
        total_duration_minutes: Number(sRow?.total_duration_minutes ?? 0),
        avg_duration_minutes: Number(sRow?.avg_duration_minutes ?? 0),
      },
      viewers: {
        total_unique: vRow?.total_unique ?? 0,
        peak_concurrent: vRow?.peak_concurrent ?? 0,
        avg_concurrent: Number(vRow?.avg_concurrent ?? 0),
      },
      recordings: {
        total_views: rRow?.total_views ?? 0,
        total_ready: rRow?.total_ready ?? 0,
      },
      top_stream: tRow
        ? {
            title: tRow.title,
            peak_viewers: tRow.peak_viewers,
            date: tRow.date,
          }
        : null,
    };

    // Financial data only for stream owner
    if (isOwner && tipRow) {
      response.tips = {
        total_xlm: Number(tipRow.total_xlm).toFixed(2),
        total_usdc: Number(tipRow.total_usdc).toFixed(2),
        total_usd_equivalent: totalUsdEquivalent,
        tip_count: tipRow.tip_count,
      };
    }

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[routes-f/metrics] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
