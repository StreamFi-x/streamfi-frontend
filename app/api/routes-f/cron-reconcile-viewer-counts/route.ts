/**
 * Cron Job: Reconcile users.current_viewers against ground truth (#1403)
 *
 * GET  /api/routes-f/cron-reconcile-viewer-counts  (Vercel Cron, every 2 min)
 * POST /api/routes-f/cron-reconcile-viewer-counts  (manual / external trigger)
 *
 * current_viewers is an independently maintained counter (incremented on
 * join, decremented on leave in app/api/streams/viewers/route.ts) that
 * drifts whenever a viewer's leave call never fires: closed tab, lost
 * connection, crashed browser. This job recomputes it from the true set of
 * stream_viewers rows still open (left_at IS NULL) for each live stream,
 * after first closing any row whose heartbeat has gone stale (see
 * lib/stream/viewer-count-reconciliation.ts and
 * db/migrations/20260926121650_add_stream_viewer_heartbeat.sql).
 *
 * Security:
 * - GET: `Authorization: Bearer $CRON_SECRET` (sent by Vercel Cron)
 * - POST: the same bearer token, an admin session, or `x-internal-secret`
 * - Overlapping runs are prevented by a database lease (job_locks)
 */

import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/jobs/cron-auth";
import { jobHttpStatus, runScheduledJob } from "@/lib/jobs/scheduled-job";
import { verifyAdminSession } from "@/lib/admin-auth";
import { createRateLimiter } from "@/lib/rate-limit";
import { reconcileViewerCounts } from "@/lib/stream/viewer-count-reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JOB_NAME = "viewer-count-reconciliation";
const SCHEDULE_SECONDS = 2 * 60;

// Manual triggers only: max 12 requests per hour
const isRateLimited = createRateLimiter(60 * 60 * 1000, 12);

async function verifyManualAuthorization(req: NextRequest): Promise<boolean> {
  if (isAuthorizedCronRequest(req)) {
    return true;
  }
  if (await verifyAdminSession()) {
    return true;
  }
  const internalSecret = process.env.INTERNAL_API_SECRET;
  return (
    !!internalSecret && req.headers.get("x-internal-secret") === internalSecret
  );
}

async function runReconciliation(): Promise<NextResponse> {
  const result = await runScheduledJob({
    name: JOB_NAME,
    leaseSeconds: 60,
    expectedIntervalSeconds: SCHEDULE_SECONDS,
    run: () => reconcileViewerCounts(),
  });

  return NextResponse.json(
    {
      job: result.job,
      status: result.status,
      started_at: result.startedAt,
      duration_ms: result.durationMs,
      metrics: result.metrics,
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.error ? { error: result.error } : {}),
      details: result.detail ?? [],
    },
    { status: jobHttpStatus(result.status) }
  );
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runReconciliation();
}

export async function POST(req: NextRequest) {
  if (!(await verifyManualAuthorization(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = req.headers.get("x-internal-secret")
    ? "internal"
    : "admin";
  if (!isAuthorizedCronRequest(req) && (await isRateLimited(identifier))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  return runReconciliation();
}
