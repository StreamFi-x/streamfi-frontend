/**
 * Cron Job: Reconcile tip totals with the Stellar ledger (#1400)
 *
 * GET /api/routes-f/cron-reconcile-tip-totals  (Vercel Cron, every 15 min)
 *
 * Re-derives users.total_tips_received / total_tips_count / last_tip_at for a
 * bounded batch of the stalest users, using the same ledger logic as the
 * manual refresh endpoint. See lib/stellar/tip-reconciliation.ts and
 * docs/reliability-jobs.md.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET`.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/jobs/cron-auth";
import { jobHttpStatus, runScheduledJob } from "@/lib/jobs/scheduled-job";
import { evaluateAndAwardBadges } from "@/lib/routes-f/badges";
import { getXlmUsdPrice } from "@/lib/routes-f/price";
import { reconcileStaleTipTotals } from "@/lib/stellar/tip-reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SCHEDULE_SECONDS = 15 * 60;

function envInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScheduledJob({
    name: "tip-total-reconciliation",
    leaseSeconds: 90,
    expectedIntervalSeconds: SCHEDULE_SECONDS,
    run: () =>
      reconcileStaleTipTotals({
        batchSize: envInt("TIP_RECONCILE_BATCH_SIZE", 25),
        staleAfterMinutes: envInt("TIP_RECONCILE_STALE_MINUTES", 360),
        concurrency: envInt("TIP_RECONCILE_CONCURRENCY", 2),
        timeBudgetMs: 45_000,
        getXlmUsdPrice,
        onTotalsChanged: async userId => {
          await evaluateAndAwardBadges(userId);
        },
      }),
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
    },
    { status: jobHttpStatus(result.status) }
  );
}
