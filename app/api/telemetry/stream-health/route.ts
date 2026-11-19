/**
 * GET /api/telemetry/stream-health
 * Query endpoint for aggregated stream health metrics
 * Returns pre-computed rollups sliceable by stream and time window
 */

import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/tracing/logger";

export const config = {
  maxDuration: 30,
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const streamId = searchParams.get("stream_id");
    const timeWindow = searchParams.get("time_window") || "24h"; // 1h, 24h, 7d
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    if (!streamId) {
      return NextResponse.json(
        { error: "Missing stream_id parameter" },
        { status: 400 }
      );
    }

    // Determine which table to query based on time window
    let metrics;

    if (timeWindow === "1h") {
      // Use hourly rollup for recent data
      metrics = await queryHourlyMetrics(streamId, startDate, endDate);
    } else if (timeWindow === "7d") {
      // Use daily rollup for week view
      metrics = await queryDailyMetrics(streamId, startDate, endDate);
    } else {
      // Default to hourly for 24h
      metrics = await queryHourlyMetrics(streamId, startDate, endDate);
    }

    if (!metrics) {
      // Fall back to computing from raw events if rollup not available
      metrics = await computeMetricsFromRaw(streamId, timeWindow);
    }

    return NextResponse.json(metrics);
  } catch (error) {
    logger.error("[telemetry] Failed to query stream health", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to fetch stream health metrics" },
      { status: 500 }
    );
  }
}

async function queryHourlyMetrics(
  streamId: string,
  startDate?: string | null,
  endDate?: string | null
) {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const { rows } = await sql`
    SELECT
      stream_id,
      hour_start,
      session_count,
      unique_viewers,
      avg_startup_time_ms,
      p50_startup_time_ms,
      p95_startup_time_ms,
      total_rebuffer_events,
      avg_rebuffer_ratio,
      error_rate,
      total_errors
    FROM playback_metrics_hourly
    WHERE stream_id = ${streamId}
      AND hour_start >= ${start}
      AND hour_start <= ${end}
    ORDER BY hour_start DESC
    LIMIT 168
  `;

  if (rows.length === 0) return null;

  return {
    streamId,
    timeWindow: "1h",
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    metrics: rows.map((row: any) => ({
      timestamp: row.hour_start,
      sessionCount: Number(row.session_count),
      uniqueViewers: Number(row.unique_viewers),
      avgStartupTimeMs: Number(row.avg_startup_time_ms || 0),
      p50StartupTimeMs: Number(row.p50_startup_time_ms || 0),
      p95StartupTimeMs: Number(row.p95_startup_time_ms || 0),
      totalRebufferEvents: Number(row.total_rebuffer_events),
      avgRebufferRatio: Number(row.avg_rebuffer_ratio || 0),
      errorRate: Number(row.error_rate || 0),
      totalErrors: Number(row.total_errors),
    })),
  };
}

async function queryDailyMetrics(
  streamId: string,
  startDate?: string | null,
  endDate?: string | null
) {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const { rows } = await sql`
    SELECT
      stream_id,
      day_start,
      session_count,
      unique_viewers,
      avg_startup_time_ms,
      p50_startup_time_ms,
      p95_startup_time_ms,
      total_rebuffer_events,
      avg_rebuffer_ratio,
      error_rate,
      total_errors
    FROM playback_metrics_daily
    WHERE stream_id = ${streamId}
      AND day_start >= ${start}
      AND day_start <= ${end}
    ORDER BY day_start DESC
    LIMIT 90
  `;

  if (rows.length === 0) return null;

  return {
    streamId,
    timeWindow: "7d",
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    metrics: rows.map((row: any) => ({
      timestamp: row.day_start,
      sessionCount: Number(row.session_count),
      uniqueViewers: Number(row.unique_viewers),
      avgStartupTimeMs: Number(row.avg_startup_time_ms || 0),
      p50StartupTimeMs: Number(row.p50_startup_time_ms || 0),
      p95StartupTimeMs: Number(row.p95_startup_time_ms || 0),
      totalRebufferEvents: Number(row.total_rebuffer_events),
      avgRebufferRatio: Number(row.avg_rebuffer_ratio || 0),
      errorRate: Number(row.error_rate || 0),
      totalErrors: Number(row.total_errors),
    })),
  };
}

/**
 * Fallback: compute metrics from raw session data if rollups not available
 */
async function computeMetricsFromRaw(streamId: string, timeWindow: string) {
  const now = new Date();
  let start: Date;

  if (timeWindow === "1h") {
    start = new Date(now.getTime() - 60 * 60 * 1000);
  } else if (timeWindow === "7d") {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  const { rows } = await sql`
    SELECT
      COUNT(DISTINCT id) as session_count,
      COUNT(DISTINCT viewer_id) as unique_viewers,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY startup_time_ms) as p50_startup,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY startup_time_ms) as p95_startup,
      AVG(startup_time_ms) as avg_startup,
      SUM(total_rebuffer_count) as total_rebuffers,
      AVG(rebuffer_ratio) as avg_rebuffer_ratio,
      SUM(CASE WHEN error_count > 0 THEN 1 ELSE 0 END)::float / COUNT(*) as error_rate
    FROM playback_session_metrics
    WHERE stream_id = ${streamId}
      AND started_at >= ${start}
      AND started_at <= ${now}
  `;

  if (rows.length === 0 || !rows[0]) {
    return {
      streamId,
      timeWindow,
      startTime: start.toISOString(),
      endTime: now.toISOString(),
      metrics: {
        sessionCount: 0,
        uniqueViewers: 0,
        avgStartupTimeMs: 0,
        p50StartupTimeMs: 0,
        p95StartupTimeMs: 0,
        totalRebufferEvents: 0,
        avgRebufferRatio: 0,
        errorRate: 0,
      },
    };
  }

  const row = rows[0];
  return {
    streamId,
    timeWindow,
    startTime: start.toISOString(),
    endTime: now.toISOString(),
    metrics: {
      sessionCount: Number(row.session_count || 0),
      uniqueViewers: Number(row.unique_viewers || 0),
      avgStartupTimeMs: Number(row.avg_startup || 0),
      p50StartupTimeMs: Number(row.p50_startup || 0),
      p95StartupTimeMs: Number(row.p95_startup || 0),
      totalRebufferEvents: Number(row.total_rebuffers || 0),
      avgRebufferRatio: Number(row.avg_rebuffer_ratio || 0),
      errorRate: Number(row.error_rate || 0),
    },
  };
}
