import { NextRequest, NextResponse } from "next/server";
import { runScheduledJob } from "@/lib/jobs/scheduled-job";
import { captureAdminAnalyticsSnapshot } from "@/lib/analytics/admin-analytics-rollup";
import { logger } from "@/lib/tracing/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/routes-f/cron-capture-admin-analytics (#1373)
 *
 * Vercel Cron endpoint. Captures daily snapshot of admin dashboard metrics.
 * Runs once per day to create a materialized rollup that replaces expensive
 * COUNT(*) queries on the admin analytics endpoint.
 *
 * Authorized via CRON_SECRET header (set by Vercel, not user-provided).
 */

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(req)) {
    logger.warn("[cron-capture-admin-analytics] Unauthorized request", {
      operation: "cron-capture-admin-analytics.POST",
      authHeader: req.headers.get("authorization"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScheduledJob(
    {
      name: "cron-capture-admin-analytics",
      alertCategory: "platform_analytics",
      timeoutSeconds: 60,
      leaseSeconds: 120,
    },
    async () => {
      const snapshot = await captureAdminAnalyticsSnapshot();

      logger.info("[cron-capture-admin-analytics] Snapshot captured", {
        operation: "cron-capture-admin-analytics.POST",
        totalUsers: snapshot.totalUsersActive,
        liveStreams: snapshot.liveStreamsCount,
      });

      return {
        summary: {
          status: "success",
          total_users_active: snapshot.totalUsersActive,
          total_users_banned: snapshot.totalUsersBanned,
          live_streams: snapshot.liveStreamsCount,
          pending_stream_reports: snapshot.pendingStreamReports,
          pending_bug_reports: snapshot.pendingBugReports,
          new_users_7d: snapshot.newUsersCount,
          total_categories: snapshot.totalCategories,
          captured_at: snapshot.capturedAt.toISOString(),
        },
      };
    }
  );

  if (result.status === "completed") {
    return NextResponse.json(
      {
        status: "success",
        message: "Admin analytics snapshot captured",
        data: result.summary,
        captured_at: new Date().toISOString(),
      },
      { status: 200 }
    );
  } else if (result.status === "skipped") {
    return NextResponse.json(
      {
        status: "skipped",
        message: "Job already running or lease held",
        reason: result.reason,
      },
      { status: 202 }
    );
  } else {
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to capture admin analytics snapshot",
        error: result.error,
      },
      { status: 500 }
    );
  }
}
