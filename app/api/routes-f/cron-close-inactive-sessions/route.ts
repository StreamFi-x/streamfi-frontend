/**
 * Cron Job: Reconcile orphaned stream sessions (#1402)
 *
 * GET  /api/routes-f/cron-close-inactive-sessions  (Vercel Cron, every 10 min)
 * POST /api/routes-f/cron-close-inactive-sessions  (manual / external trigger)
 *
 * Closes stream_sessions rows left open after a missed Mux idle webhook. A
 * session is closed only when Mux reports its live stream as idle, disabled
 * or deleted; if Mux cannot be reached the session is left alone. Closed rows
 * get an estimated ended_at and end_source = 'reconciliation'. The logic lives
 * in lib/stream/session-reconciliation.ts; see docs/reliability-jobs.md.
 *
 * Security:
 * - GET: `Authorization: Bearer $CRON_SECRET` (sent by Vercel Cron)
 * - POST: the same bearer token, an admin session, or `x-internal-secret`
 * - Overlapping runs are prevented by a database lease (job_locks)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { isAuthorizedCronRequest } from "@/lib/jobs/cron-auth";
import { jobHttpStatus, runScheduledJob } from "@/lib/jobs/scheduled-job";
import { getMuxLiveStreamState } from "@/lib/mux/server";
import { sql } from "@vercel/postgres";
import { requireAdminSecret, verifyAdminSession } from "@/lib/admin-auth";
import { createRateLimiter } from "@/lib/rate-limit";
import { reconcileOrphanedSessions } from "@/lib/stream/session-reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JOB_NAME = "stream-session-reconciliation";
const SCHEDULE_SECONDS = 10 * 60;

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
    leaseSeconds: 120,
    expectedIntervalSeconds: SCHEDULE_SECONDS,
    run: () =>
      reconcileOrphanedSessions({ getStreamState: getMuxLiveStreamState }),
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
