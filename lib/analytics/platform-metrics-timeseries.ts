/**
 * Platform metrics time-series rollup job (#1374)
 *
 * Captures hourly/daily snapshots of key platform metrics:
 * - DAU / MAU (Daily/Monthly Active Users)
 * - Live streams count
 * - Tip volume (XLM and USD equivalent)
 * - Total streaming hours
 * - New creators count
 *
 * Enables trend analysis and historical visibility into platform health.
 * Supports multiple aggregation granularities (hourly, daily, monthly).
 */

import { sql } from "@vercel/postgres";
import { logger } from "@/lib/tracing/logger";
import { startOfHour, startOfDay, startOfMonth } from "date-fns";

export interface MetricCaptureResult {
  metricKey: string;
  granularity: "hourly" | "daily" | "monthly";
  timestamp: Date;
  value: number;
  rowsCaptured: number;
}

/**
 * Calculate DAU (Daily Active Users)
 * Returns count of distinct users with activity in a day
 */
async function calculateDAU(day: Date): Promise<number> {
  const startOfDay_ = startOfDay(day);
  const endOfDay = new Date(startOfDay_);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { rows } = await sql`
    SELECT COUNT(DISTINCT user_id) as dau
    FROM (
      SELECT DISTINCT user_id FROM stream_viewers
      WHERE joined_at >= ${startOfDay_} AND joined_at < ${endOfDay}
      UNION
      SELECT DISTINCT follower_id FROM user_follows
      WHERE created_at >= ${startOfDay_} AND created_at < ${endOfDay}
      UNION
      SELECT DISTINCT supporter_id FROM tip_transactions
      WHERE created_at >= ${startOfDay_} AND created_at < ${endOfDay}
      UNION
      SELECT DISTINCT creator_id FROM stream_sessions
      WHERE started_at >= ${startOfDay_} AND started_at < ${endOfDay}
    ) AS active_users
  `;

  return Number(rows[0]?.dau || 0);
}

/**
 * Calculate live streams count at a point in time
 */
async function calculateLiveStreams(): Promise<number> {
  const { rows } = await sql`
    SELECT COUNT(*) as live_count
    FROM stream_sessions
    WHERE ended_at IS NULL AND started_at <= NOW()
  `;

  return Number(rows[0]?.live_count || 0);
}

/**
 * Calculate total tips volume in USD for a day
 */
async function calculateTipsVolumeUSD(day: Date): Promise<number> {
  const startOfDay_ = startOfDay(day);
  const endOfDay = new Date(startOfDay_);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { rows } = await sql`
    SELECT COALESCE(SUM(price_usd), 0) as total_usd
    FROM tip_transactions
    WHERE created_at >= ${startOfDay_} AND created_at < ${endOfDay}
  `;

  return Number(rows[0]?.total_usd || 0);
}

/**
 * Calculate total tips volume in XLM for a day
 */
async function calculateTipsVolumeXLM(day: Date): Promise<number> {
  const startOfDay_ = startOfDay(day);
  const endOfDay = new Date(startOfDay_);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { rows } = await sql`
    SELECT COALESCE(SUM(amount_xlm), 0) as total_xlm
    FROM tip_transactions
    WHERE created_at >= ${startOfDay_} AND created_at < ${endOfDay}
  `;

  return Number(rows[0]?.total_xlm || 0);
}

/**
 * Calculate total streaming hours for a day
 */
async function calculateStreamingHours(day: Date): Promise<number> {
  const startOfDay_ = startOfDay(day);
  const endOfDay = new Date(startOfDay_);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { rows } = await sql`
    SELECT COALESCE(
      SUM(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) / 3600),
      0
    ) as total_hours
    FROM stream_sessions
    WHERE started_at >= ${startOfDay_} AND started_at < ${endOfDay}
  `;

  return Number(rows[0]?.total_hours || 0);
}

/**
 * Calculate new creators count for a day
 * (users who started their first stream in this day)
 */
async function calculateNewCreators(day: Date): Promise<number> {
  const startOfDay_ = startOfDay(day);
  const endOfDay = new Date(startOfDay_);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { rows } = await sql`
    SELECT COUNT(DISTINCT user_id) as new_creators
    FROM stream_sessions ss
    WHERE ss.started_at >= ${startOfDay_} AND ss.started_at < ${endOfDay}
      AND NOT EXISTS (
        SELECT 1 FROM stream_sessions ss2
        WHERE ss2.user_id = ss.user_id
          AND ss2.started_at < ${startOfDay_}
      )
  `;

  return Number(rows[0]?.new_creators || 0);
}

/**
 * Capture a platform metric for a specific time period
 * Returns the captured value and rows affected
 */
export async function captureMetric(
  metricKey: string,
  granularity: "hourly" | "daily" | "monthly",
  timestamp: Date
): Promise<MetricCaptureResult> {
  let value = 0;
  let normalizedTimestamp = timestamp;

  // Normalize timestamp based on granularity
  if (granularity === "hourly") {
    normalizedTimestamp = startOfHour(timestamp);
  } else if (granularity === "daily") {
    normalizedTimestamp = startOfDay(timestamp);
  } else if (granularity === "monthly") {
    normalizedTimestamp = startOfMonth(timestamp);
  }

  try {
    // Get metric definition
    const { rows: metricRows } = await sql`
      SELECT id, version, status FROM metric_definitions
      WHERE key = ${metricKey} AND status = 'active'
      LIMIT 1
    `;

    if (metricRows.length === 0) {
      throw new Error(`Unknown metric: ${metricKey}`);
    }

    const metricDef = metricRows[0];
    const metricVersion = Number(metricDef.version);

    // Calculate metric value based on key
    switch (metricKey) {
      case "dau":
        value = await calculateDAU(normalizedTimestamp);
        break;
      case "live_streams":
        value = await calculateLiveStreams();
        break;
      case "tips_volume_usd":
        value = await calculateTipsVolumeUSD(normalizedTimestamp);
        break;
      case "tips_volume_xlm":
        value = await calculateTipsVolumeXLM(normalizedTimestamp);
        break;
      case "stream_hours":
        value = await calculateStreamingHours(normalizedTimestamp);
        break;
      case "new_creators":
        value = await calculateNewCreators(normalizedTimestamp);
        break;
      default:
        throw new Error(`Unsupported metric: ${metricKey}`);
    }

    // Determine appropriate table based on granularity
    if (granularity === "hourly") {
      await sql`
        INSERT INTO platform_metrics_hourly (
          metric_key, metric_version, hour_timestamp, value, value_type
        )
        VALUES (${metricKey}, ${metricVersion}, ${normalizedTimestamp}, ${value}, 'count')
        ON CONFLICT (metric_key, metric_version, hour_timestamp)
        DO UPDATE SET value = EXCLUDED.value, captured_at = NOW()
      `;
    } else if (granularity === "daily") {
      await sql`
        INSERT INTO platform_metrics_daily (
          metric_key, metric_version, day_timestamp, value, value_type, source
        )
        VALUES (${metricKey}, ${metricVersion}, ${normalizedTimestamp}, ${value}, 'count', 'computed')
        ON CONFLICT (metric_key, metric_version, day_timestamp)
        DO UPDATE SET value = EXCLUDED.value, captured_at = NOW()
      `;
    } else if (granularity === "monthly") {
      await sql`
        INSERT INTO platform_metrics_monthly (
          metric_key, metric_version, month_timestamp, value, value_type, source
        )
        VALUES (${metricKey}, ${metricVersion}, ${normalizedTimestamp}, ${value}, 'count', 'computed')
        ON CONFLICT (metric_key, metric_version, month_timestamp)
        DO UPDATE SET value = EXCLUDED.value, captured_at = NOW()
      `;
    }

    logger.info("[platform-metrics] Metric captured", {
      operation: "captureMetric",
      metricKey,
      granularity,
      value,
      timestamp: normalizedTimestamp.toISOString(),
    });

    return {
      metricKey,
      granularity,
      timestamp: normalizedTimestamp,
      value,
      rowsCaptured: 1,
    };
  } catch (error) {
    logger.error("[platform-metrics] Failed to capture metric", {
      operation: "captureMetric",
      metricKey,
      granularity,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get metric trend data for a date range
 */
export async function getMetricTrend(
  metricKey: string,
  granularity: "hourly" | "daily" | "monthly",
  startDate: Date,
  endDate: Date,
  limit: number = 365
): Promise<Array<{ timestamp: Date; value: number }>> {
  try {
    let rows;

    if (granularity === "hourly") {
      const result = await sql`
        SELECT hour_timestamp, value
        FROM platform_metrics_hourly
        WHERE metric_key = ${metricKey}
          AND hour_timestamp >= ${startDate}
          AND hour_timestamp <= ${endDate}
        ORDER BY hour_timestamp DESC
        LIMIT ${limit}
      `;
      rows = result.rows;
    } else if (granularity === "daily") {
      const result = await sql`
        SELECT day_timestamp, value
        FROM platform_metrics_daily
        WHERE metric_key = ${metricKey}
          AND day_timestamp >= ${startDate}
          AND day_timestamp <= ${endDate}
        ORDER BY day_timestamp DESC
        LIMIT ${limit}
      `;
      rows = result.rows;
    } else if (granularity === "monthly") {
      const result = await sql`
        SELECT month_timestamp, value
        FROM platform_metrics_monthly
        WHERE metric_key = ${metricKey}
          AND month_timestamp >= ${startDate}
          AND month_timestamp <= ${endDate}
        ORDER BY month_timestamp DESC
        LIMIT ${limit}
      `;
      rows = result.rows;
    } else {
      throw new Error(`Invalid granularity: ${granularity}`);
    }

    return rows.map((row) => ({
      timestamp: new Date(granularity === "hourly" ? row.hour_timestamp : granularity === "daily" ? row.day_timestamp : row.month_timestamp),
      value: Number(row.value),
    }));
  } catch (error) {
    logger.error("[platform-metrics] Failed to get metric trend", {
      operation: "getMetricTrend",
      metricKey,
      granularity,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
