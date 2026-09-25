import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { assertJobFresh, runScheduledJob } from "@/lib/jobs/scheduled-job";
import { purgeExpiredMuxWebhookEvents } from "@/lib/mux/webhook-retention";
import { MUX_RECONCILE_JOB } from "@/lib/mux/reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/routes-f/cron-purge-mux-webhook-events (#1397)
 *
 * Daily Vercel Cron. Deletes mux_webhook_events rows past their retention
 * window (see lib/mux/webhook-retention.ts). It also checks that the Mux
 * reconciliation job has succeeded within the last hour, so a reconciliation
 * cron that silently stopped firing is still noticed.
 */
async function handle(req: Request): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScheduledJob(
    {
      name: "mux_webhook_event_purge",
      alertCategory: "mux_webhooks",
      timeoutSeconds: 45,
      leaseSeconds: 120,
    },
    async () => ({ summary: { ...(await purgeExpiredMuxWebhookEvents()) } })
  );

  let reconciliationFresh: boolean | null = null;
  try {
    reconciliationFresh = await assertJobFresh(
      MUX_RECONCILE_JOB,
      60 * 60,
      "mux_reconciliation"
    );
  } catch {
    reconciliationFresh = null;
  }

  return NextResponse.json(
    { ...result, reconciliation_fresh: reconciliationFresh },
    { status: result.status === "failed" ? 500 : 200 }
  );
}

export const GET = handle;
export const POST = handle;
