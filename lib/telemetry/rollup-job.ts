/**
 * Telemetry metrics rollup job
 * Aggregates raw events into hourly/daily rollups for efficient querying
 * Should be run periodically (e.g., via cron job or background worker)
 */

import { sql } from "@vercel/postgres";
import { logger } from "@/lib/tracing/logger";

/**
 * Rollup hourly metrics from raw telemetry events
 * Call this every hour to compute aggregates
 */
export async function rollupHourlyMetrics() {
  try {
    // Get the previous hour boundary
    const now = new Date();
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);
    hourStart.setHours(hourStart.getHours() - 1);

    const hourEnd = new Date(hourStart);
    hourEnd.setHours(hourEnd.getHours() + 1);

    logger.info("[telemetry-rollup] Starting hourly rollup", {
      hourStart: hourStart.toISOString(),
      hourEnd: hourEnd.toISOString(),
    });

    // Get unique streams with events in this hour
    const { rows: streams } = await sql`
      SELECT DISTINCT stream_id
      FROM playback_telemetry_events
      WHERE recorded_at >= ${hourStart}
        AND recorded_at < ${hourEnd}
    `;

    let processedStreams = 0;

    for (const streamRow of streams) {
      const streamId = streamRow.stream_id;

      // Get session-level data for this stream in this hour
      const { rows: sessions } = await sql`
        SELECT
          COUNT(DISTINCT session_id) as session_count,
          COUNT(DISTINCT viewer_id) as unique_viewers,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY startup_time_ms) as p50_startup,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY startup_time_ms) as p95_startup,
          AVG(startup_time_ms) as avg_startup,
          SUM(total_rebuffer_count) as total_rebuffers,
          AVG(rebuffer_ratio) as avg_rebuffer_ratio,
          SUM(CASE WHEN error_count > 0 THEN 1 ELSE 0 END)::float / COUNT(*) as error_rate,
          SUM(error_count) as total_errors
        FROM playback_session_metrics
        WHERE stream_id = ${streamId}
          AND started_at >= ${hourStart}
          AND started_at < ${hourEnd}
      `;

      if (sessions.length > 0 && sessions[0].session_count > 0) {
        const data = sessions[0];

        // Upsert hourly metrics
        await sql`
          INSERT INTO playback_metrics_hourly (
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
          ) VALUES (
            ${streamId},
            ${hourStart},
            ${Number(data.session_count)},
            ${Number(data.unique_viewers)},
            ${Number(data.avg_startup) || 0},
            ${Number(data.p50_startup) || 0},
            ${Number(data.p95_startup) || 0},
            ${Number(data.total_rebuffers) || 0},
            ${Number(data.avg_rebuffer_ratio) || 0},
            ${Number(data.error_rate) || 0},
            ${Number(data.total_errors) || 0}
          )
          ON CONFLICT (stream_id, hour_start) DO UPDATE SET
            session_count = EXCLUDED.session_count,
            unique_viewers = EXCLUDED.unique_viewers,
            avg_startup_time_ms = EXCLUDED.avg_startup_time_ms,
            p50_startup_time_ms = EXCLUDED.p50_startup_time_ms,
            p95_startup_time_ms = EXCLUDED.p95_startup_time_ms,
            total_rebuffer_events = EXCLUDED.total_rebuffer_events,
            avg_rebuffer_ratio = EXCLUDED.avg_rebuffer_ratio,
            error_rate = EXCLUDED.error_rate,
            total_errors = EXCLUDED.total_errors
        `;

        processedStreams++;
      }
    }

    logger.info("[telemetry-rollup] Hourly rollup completed", {
      streamsProcessed: processedStreams,
      hourStart: hourStart.toISOString(),
    });

    return { success: true, streamsProcessed };
  } catch (error) {
    logger.error("[telemetry-rollup] Hourly rollup failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Rollup daily metrics from hourly rollups
 * Call this once per day (e.g., at midnight UTC)
 */
export async function rollupDailyMetrics() {
  try {
    // Get yesterday's date
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - 1);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    logger.info("[telemetry-rollup] Starting daily rollup", {
      dayStart: dayStart.toISOString(),
      dayEnd: dayEnd.toISOString(),
    });

    // Get unique streams with hourly metrics in this day
    const { rows: streams } = await sql`
      SELECT DISTINCT stream_id
      FROM playback_metrics_hourly
      WHERE hour_start >= ${dayStart}
        AND hour_start < ${dayEnd}
    `;

    let processedStreams = 0;

    for (const streamRow of streams) {
      const streamId = streamRow.stream_id;

      // Aggregate hourly data into daily
      const { rows: dayData } = await sql`
        SELECT
          SUM(session_count) as session_count,
          SUM(unique_viewers) as unique_viewers,
          AVG(p50_startup_time_ms) as p50_startup,
          AVG(p95_startup_time_ms) as p95_startup,
          AVG(avg_startup_time_ms) as avg_startup,
          SUM(total_rebuffer_events) as total_rebuffers,
          AVG(avg_rebuffer_ratio) as avg_rebuffer_ratio,
          AVG(error_rate) as error_rate,
          SUM(total_errors) as total_errors
        FROM playback_metrics_hourly
        WHERE stream_id = ${streamId}
          AND hour_start >= ${dayStart}
          AND hour_start < ${dayEnd}
      `;

      if (dayData.length > 0 && dayData[0].session_count > 0) {
        const data = dayData[0];

        // Upsert daily metrics
        await sql`
          INSERT INTO playback_metrics_daily (
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
          ) VALUES (
            ${streamId},
            ${dayStart},
            ${Number(data.session_count)},
            ${Number(data.unique_viewers)},
            ${Number(data.avg_startup) || 0},
            ${Number(data.p50_startup) || 0},
            ${Number(data.p95_startup) || 0},
            ${Number(data.total_rebuffers) || 0},
            ${Number(data.avg_rebuffer_ratio) || 0},
            ${Number(data.error_rate) || 0},
            ${Number(data.total_errors) || 0}
          )
          ON CONFLICT (stream_id, day_start) DO UPDATE SET
            session_count = EXCLUDED.session_count,
            unique_viewers = EXCLUDED.unique_viewers,
            avg_startup_time_ms = EXCLUDED.avg_startup_time_ms,
            p50_startup_time_ms = EXCLUDED.p50_startup_time_ms,
            p95_startup_time_ms = EXCLUDED.p95_startup_time_ms,
            total_rebuffer_events = EXCLUDED.total_rebuffer_events,
            avg_rebuffer_ratio = EXCLUDED.avg_rebuffer_ratio,
            error_rate = EXCLUDED.error_rate,
            total_errors = EXCLUDED.total_errors
        `;

        processedStreams++;
      }
    }

    logger.info("[telemetry-rollup] Daily rollup completed", {
      streamsProcessed: processedStreams,
      dayStart: dayStart.toISOString(),
    });

    return { success: true, streamsProcessed };
  } catch (error) {
    logger.error("[telemetry-rollup] Daily rollup failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
