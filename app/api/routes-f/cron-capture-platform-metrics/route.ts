import { NextRequest, NextResponse } from "next/server";
import { runScheduledJob } from "@/lib/jobs/scheduled-job";
import { captureMetric } from "@/lib/analytics/platform-metrics-timeseries";
import { logger } from "@/lib/tracing/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/routes-f/cron-capture-platform-metrics (#1374)
 *
 * Vercel Cron endpoint. Captures daily snapshots of key platform metrics:
 * - DAU, Live streams, Tip volume, Streaming hours, New creators
 *
 * Runs once per day (typically midnight UTC) to create time-series data
 * that enables trend analysis and historical visibility into platform health.
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

const PLATFORM_METRICS = [
  "dau",
  "live_streams",
  "tips_volume_usd",
  "tips_volume_xlm",
  "stream_hours",
  "new_creators",
] as const;

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(req)) {
    logger.warn("[cron-capture-platform-metrics] Unauthorized request", {
      operation: "cron-capture-platform-metrics.POST",
      authHeader: req.headers.get("authorization"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScheduledJob(
    {
      name: "cron-capture-platform-metrics",
      alertCategory: "platform_analytics",
      timeoutSeconds: 300, // 5 minutes for all metrics
      leaseSeconds: 600, // 10 minutes lease
    },
    async () => {
      const now = new Date();
      const capturedMetrics: Record<string, number> = {};
      let successCount = 0;
      let failureCount = 0;

      // Capture each metric
      for (const metricKey of PLATFORM_METRICS) {
        try {
          const result = await captureMetric(metricKey, "daily", now);
          capturedMetrics[metricKey] = result.value;
          successCount++;

          logger.debug("[cron-capture-platform-metrics] Metric captured", {
            operation: "cron-capture-platform-metrics.POST",
            metricKey,
            value: result.value,
          });
        } catch (error) {
          failureCount++;
          logger.warn("[cron-capture-platform-metrics] Failed to capture metric", {
            operation: "cron-capture-platform-metrics.POST",
            metricKey,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info("[cron-capture-platform-metrics] Metric capture completed", {
        operation: "cron-capture-platform-metrics.POST",
        successCount,
        failureCount,
        metrics: capturedMetrics,
      });

      return {
        summary: {
          status: failureCount === 0 ? "success" : "partial",
          captured_metrics: capturedMetrics,
          success_count: successCount,
          failure_count: failureCount,
          captured_at: now.toISOString(),
        },
      };
    }
  );

  if (result.status === "completed") {
    const isPartial = result.summary.failure_count > 0;
    return NextResponse.json(
      {
        status: isPartial ? "partial_success" : "success",
        message: "Platform metrics captured",
        data: result.summary,
      },
      { status: isPartial ? 207 : 200 }
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
        message: "Failed to capture platform metrics",
        error: result.error,
      },
      { status: 500 }
    );
  }
}
