import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/jobs/cron-auth";
import { runScheduledJob } from "@/lib/jobs/run-job";
import { runMuxReconciliation } from "@/lib/mux/reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Vercel Cron: Mux asset <-> stream_recordings consistency sweep (#1409). */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScheduledJob(
    "mux-reconciliation",
    { leaseSeconds: 600, budgetMs: 240_000 },
    runMuxReconciliation
  );

  return NextResponse.json(result, {
    status: result.outcome === "failed" ? 500 : 200,
  });
}

/** Manual trigger with the same bearer token (other routes-f cron jobs use POST). */
export const POST = GET;
