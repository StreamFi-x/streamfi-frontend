import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/routes-f/cron-refresh-materialized-views (#1556)
 *
 * Vercel Cron endpoint. Refreshes the platform's analytics materialized
 * views with REFRESH MATERIALIZED VIEW CONCURRENTLY so reads against the
 * views are never blocked while a refresh is in progress.
 *
 * CONCURRENTLY requires a unique index on each view — without one,
 * Postgres rejects the refresh with an error, which this route surfaces
 * per-view rather than aborting the whole run.
 */

const ANALYTICS_MATERIALIZED_VIEWS = [
  "creator_earnings_summary",
  "stream_engagement_daily",
  "platform_activity_summary",
] as const;

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {return false;}

  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

interface RefreshResult {
  view: string;
  status: "refreshed" | "failed";
  error?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: RefreshResult[] = [];

  for (const view of ANALYTICS_MATERIALIZED_VIEWS) {
    try {
      // Vercel Postgres' `sql` tagged template does not allow
      // parameterizing identifiers (view names), and this list is a
      // fixed, hardcoded constant above — never derived from request
      // input — so building the statement this way is safe.
      await sql.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
      results.push({ view, status: "refreshed" });
    } catch (error) {
      console.error(
        `[cron-refresh-materialized-views] failed for ${view}:`,
        error
      );
      results.push({
        view,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const failedCount = results.filter(r => r.status === "failed").length;

  return NextResponse.json(
    {
      refreshed_at: new Date().toISOString(),
      total: results.length,
      succeeded: results.length - failedCount,
      failed: failedCount,
      results,
    },
    { status: failedCount > 0 ? 207 : 200 }
  );
}
