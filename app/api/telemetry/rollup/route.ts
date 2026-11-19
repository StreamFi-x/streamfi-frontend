/**
 * POST /api/telemetry/rollup
 * Endpoint to trigger manual rollup of telemetry metrics
 * Can be called by a cron job or background worker
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/tracing/logger";
import { rollupHourlyMetrics, rollupDailyMetrics } from "@/lib/telemetry/rollup-job";

export const config = {
  maxDuration: 300, // 5 minutes
};

export async function POST(request: NextRequest) {
  try {
    // Optional: add authentication here (e.g., verify authorization header)
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { rollupType } = await request.json();

    if (rollupType === "hourly") {
      const result = await rollupHourlyMetrics();
      return NextResponse.json({
        success: true,
        rollupType: "hourly",
        ...result,
      });
    } else if (rollupType === "daily") {
      const result = await rollupDailyMetrics();
      return NextResponse.json({
        success: true,
        rollupType: "daily",
        ...result,
      });
    } else if (rollupType === "all") {
      const hourlyResult = await rollupHourlyMetrics();
      const dailyResult = await rollupDailyMetrics();
      return NextResponse.json({
        success: true,
        hourly: hourlyResult,
        daily: dailyResult,
      });
    } else {
      return NextResponse.json(
        { error: "Invalid rollupType" },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error("[telemetry] Rollup request failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to trigger rollup" },
      { status: 500 }
    );
  }
}
