/**
 * Cron Job: Mux asset <-> stream_recordings / stream_clips sweep (#1409)
 *
 * GET /api/routes-f/cron-mux-asset-reconciliation  (Vercel Cron, daily)
 *
 * Complements the live-state reconciliation (cron-mux-reconcile, #1399),
 * which only repairs users.is_live. See lib/mux/asset-reconciliation.ts and
 * docs/data-integrity.md.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET`.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/jobs/cron-auth";
import { jobHttpStatus, runScheduledJob } from "@/lib/jobs/scheduled-job";
import { runMuxReconciliation } from "@/lib/mux/asset-reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TIME_BUDGET_MS = 240_000;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScheduledJob({
    name: "mux-asset-reconciliation",
    leaseSeconds: 360,
    expectedIntervalSeconds: 24 * 60 * 60,
    run: ({ runId }) => {
      const startedAt = Date.now();
      return runMuxReconciliation({
        runId,
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
