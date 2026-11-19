/**
 * Cron Job: orphaned Mux live-stream sweep (#758)
 *
 * GET /api/routes-f/cron-mux-orphan-sweep  (Vercel Cron, hourly)
 *
 * Deletes app-created Mux live streams that no user references, left behind
 * when a create call timed out after Mux had already processed it. See
 * lib/mux/orphan-sweep.ts.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET`.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/jobs/cron-auth";
import { jobHttpStatus, runScheduledJob } from "@/lib/jobs/scheduled-job";
import { runMuxOrphanSweep } from "@/lib/mux/orphan-sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TIME_BUDGET_MS = 240_000;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScheduledJob({
    name: "mux-orphan-sweep",
    leaseSeconds: 360,
    expectedIntervalSeconds: 60 * 60,
    run: () => {
      const startedAt = Date.now();
      return runMuxOrphanSweep({
        deadlineExpired: () => Date.now() - startedAt > TIME_BUDGET_MS,
      });
    },
  });

  return NextResponse.json(
    {
      job: result.job,
      run_id: result.runId,
      status: result.status,
      duration_ms: result.durationMs,
      metrics: result.metrics,
      detail: result.detail,
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.error ? { error: result.error } : {}),
    },
    { status: jobHttpStatus(result.status) }
  );
}

/** Manual trigger with the same bearer token. */
export const POST = GET;
