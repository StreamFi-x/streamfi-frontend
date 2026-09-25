import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/jobs/cron-auth";
import { runScheduledJob } from "@/lib/jobs/run-job";
import { errorMessage } from "@/lib/jobs/runs";
import { runTipReconciliation } from "@/lib/stellar/tip-reconciliation";
import {
  TIP_RECONCILIATION_JOB,
  deliverPendingAlerts,
  evaluatePendingRuns,
} from "@/lib/alerts/tip-reconciliation-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel Cron: reconcile tip_transactions against Horizon, then evaluate the
 * finished run(s) against the historical baseline and deliver alerts (#1405).
 * Evaluation and delivery run even when this invocation's reconciliation was
 * skipped or failed, so a stuck evaluator or undelivered alert is retried.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reconciliation = await runScheduledJob(
    TIP_RECONCILIATION_JOB,
    { leaseSeconds: 600, budgetMs: 200_000 },
    runTipReconciliation
  );

  let alerting: Record<string, unknown>;
  try {
    const evaluation = await evaluatePendingRuns();
    const delivery = await deliverPendingAlerts();
    alerting = { ...evaluation, ...delivery };
  } catch (err) {
    console.error(
      JSON.stringify({
        job: "tip-reconciliation-alerts",
        outcome: "failed",
        error: errorMessage(err),
      })
    );
    alerting = { error: errorMessage(err) };
  }

  const failed = reconciliation.outcome === "failed" || "error" in alerting;
  return NextResponse.json(
    { reconciliation, alerting },
    { status: failed ? 500 : 200 }
  );
}
