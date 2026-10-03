/**
 * Cron Job: purge accounts whose deletion grace window has elapsed (#1406)
 *
 * GET /api/routes-f/cron-purge-deleted-users  (Vercel Cron, daily)
 *
 * See lib/users/deletion.ts and docs/data-integrity.md.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET`.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/jobs/cron-auth";
import { jobHttpStatus, runScheduledJob } from "@/lib/jobs/scheduled-job";
import { purgeDueDeletions } from "@/lib/users/deletion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TIME_BUDGET_MS = 240_000;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScheduledJob({
    name: "purge-deleted-users",
    leaseSeconds: 360,
    expectedIntervalSeconds: 24 * 60 * 60,
    run: async () => {
      const startedAt = Date.now();
      const metrics = await purgeDueDeletions({
        batchSize: 25,
        deadlineExpired: () => Date.now() - startedAt > TIME_BUDGET_MS,
      });
      const alerts =
        metrics.failed > 0
          ? [
              `${metrics.failed} account purge(s) failed; see /api/admin/users/deletions?status=failed`,
            ]
          : [];
      return {
        status:
          metrics.failed > 0 && metrics.purged === 0
            ? "failed"
            : metrics.failed > 0 || metrics.skipped_deadline > 0
              ? "partial"
              : "succeeded",
        metrics,
        alerts,
      };
    },
  });

  return NextResponse.json(
    {
      job: result.job,
      run_id: result.runId,
      status: result.status,
      duration_ms: result.durationMs,
      metrics: result.metrics,
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.error ? { error: result.error } : {}),
    },
    { status: jobHttpStatus(result.status) }
  );
}

/** Manual trigger with the same bearer token. */
export const POST = GET;
