import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/routes-f/cron-cleanup-expired-clips (#1554)
 *
 * Vercel Cron endpoint. Removes clip generation jobs that failed and are
 * older than 24 hours, so the clip_jobs table doesn't accumulate stale
 * failure rows indefinitely.
 */

const FAILED_JOB_MAX_AGE_HOURS = 24;

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rows } = await sql`
      DELETE FROM clip_jobs
      WHERE status = 'failed'
        AND created_at < NOW() - (${FAILED_JOB_MAX_AGE_HOURS} || ' hours')::interval
      RETURNING id
    `;

    return NextResponse.json({
      cleaned_at: new Date().toISOString(),
      max_age_hours: FAILED_JOB_MAX_AGE_HOURS,
      removed_count: rows.length,
      removed_ids: rows.map(r => r.id),
    });
  } catch (error) {
    console.error("[cron-cleanup-expired-clips] failed:", error);
    return NextResponse.json(
      { error: "Failed to clean up expired clip jobs" },
      { status: 500 }
    );
  }
}
