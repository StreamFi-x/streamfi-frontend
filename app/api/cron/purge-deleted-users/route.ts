import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/jobs/cron-auth";
import { runScheduledJob } from "@/lib/jobs/run-job";
import { purgeDueDeletions } from "@/lib/users/deletion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Vercel Cron: purge accounts whose deletion grace window has elapsed (#1406). */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScheduledJob(
    "purge-deleted-users",
    { leaseSeconds: 600, budgetMs: 240_000 },
    async ({ deadlineExpired }) => {
      const metrics = await purgeDueDeletions({
        batchSize: 25,
        deadlineExpired,
      });
      return {
        status:
          metrics.skipped_deadline > 0 || metrics.failed > 0
            ? "partial"
            : "completed",
        metrics,
      };
    }
  );

  return NextResponse.json(result, {
    status: result.outcome === "failed" ? 500 : 200,
  });
}
