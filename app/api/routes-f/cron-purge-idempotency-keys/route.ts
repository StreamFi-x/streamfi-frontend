/**
 * Cron Job: Purge expired idempotency keys (#1401)
 *
 * GET /api/routes-f/cron-purge-idempotency-keys  (Vercel Cron, daily)
 *
 * Deletes keys past their retention window in bounded batches. Rows still
 * owned by a running request are never removed. Safe to run repeatedly.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET`.
 */
import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredIdempotencyKeys } from "@/lib/idempotency/store";
import { isAuthorizedCronRequest } from "@/lib/jobs/cron-auth";
import { jobHttpStatus, runScheduledJob } from "@/lib/jobs/scheduled-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScheduledJob({
    name: "idempotency-key-purge",
    leaseSeconds: 120,
    expectedIntervalSeconds: 24 * 60 * 60,
    run: async () => ({
      status: "succeeded",
      metrics: { purged: await purgeExpiredIdempotencyKeys() },
    }),
  });

  return NextResponse.json(
    {
      job: result.job,
      status: result.status,
      metrics: result.metrics,
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.error ? { error: result.error } : {}),
    },
    { status: jobHttpStatus(result.status) }
  );
}
