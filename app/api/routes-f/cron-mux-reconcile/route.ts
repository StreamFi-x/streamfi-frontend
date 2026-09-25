import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runScheduledJob } from "@/lib/jobs/scheduled-job";
import {
  MUX_RECONCILE_JOB,
  alertOnAbnormalDrift,
  correctionCount,
  reconcileMuxLiveState,
  reconciliationConfigFromEnv,
  type ReconciliationSummary,
} from "@/lib/mux/reconciliation";
import {
  getMuxLiveStreamStatus,
  listActiveMuxLiveStreamIds,
} from "@/lib/mux/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/routes-f/cron-mux-reconcile (#1399)
 *
 * Vercel Cron (every 5 minutes, see vercel.json). Compares Mux's live
 * streams with users.is_live and repairs drift in both directions. Runs
 * under a DB lease so invocations never overlap; failures are recorded in
 * scheduled_job_runs and alerted. POST is accepted for manual runs with the
 * same CRON_SECRET bearer token.
 */

async function handle(req: Request): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = reconciliationConfigFromEnv();
  let summary: ReconciliationSummary | null = null;

  const result = await runScheduledJob(
    {
      name: MUX_RECONCILE_JOB,
      alertCategory: "mux_reconciliation",
      timeoutSeconds: 45,
      leaseSeconds: 120,
    },
    async () => {
      summary = await reconcileMuxLiveState(
        {
          listActive: listActiveMuxLiveStreamIds,
          getStatus: getMuxLiveStreamStatus,
        },
        config
      );
      return {
        summary,
        drift: correctionCount(summary) + summary.deferred > 0,
      };
    }
  );

  if (result.status === "completed" && summary) {
    await alertOnAbnormalDrift(summary, result.consecutiveDriftRuns, config);
  }

  return NextResponse.json(result, {
    status: result.status === "failed" ? 500 : 200,
  });
}

export const GET = handle;
export const POST = handle;
