/**
 * Admin analytics rollup job (#1373)
 *
 * Captures daily snapshots of key admin dashboard metrics:
 * - Total users, banned users
 * - Live streams count
 * - Pending reports (streams, bugs)
 * - New users in last 7 days
 * - Total categories
 *
 * These snapshots are materialized to avoid expensive COUNT(*) queries on every request.
 */

import { sql } from "@vercel/postgres";
import { logger } from "@/lib/tracing/logger";

export interface AdminAnalyticsSnapshot {
  totalUsersActive: number;
  totalUsersBanned: number;
  liveStreamsCount: number;
  pendingStreamReports: number;
  pendingBugReports: number;
  newUsersCount: number;
  totalCategories: number;
  capturedAt: Date;
}

/**
 * Capture current admin analytics metrics and store as daily rollup
 * Idempotent: safe to call multiple times per day
 */
export async function captureAdminAnalyticsSnapshot(): Promise<AdminAnalyticsSnapshot> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // Query current metrics
    const { rows } = await sql`
      SELECT
        (SELECT COUNT(*) FROM users WHERE is_banned = false) AS total_users_active,
        (SELECT COUNT(*) FROM users WHERE is_banned = true) AS total_users_banned,
        (SELECT COUNT(*) FROM users WHERE is_live = true) AS live_streams_count,
        (SELECT COUNT(*) FROM stream_reports WHERE status = 'pending') AS pending_stream_reports,
        (SELECT COUNT(*) FROM bug_reports WHERE status = 'pending') AS pending_bug_reports,
        (SELECT COUNT(*) FROM users WHERE created_at > now() - INTERVAL '7 days') AS new_users_count,
        (SELECT COUNT(*) FROM stream_categories) AS total_categories
    `;

    const snapshot = rows[0];

    // Upsert daily rollup
    await sql`
      INSERT INTO admin_analytics_daily_rollup (
        metric_date,
        total_users_active,
        total_users_banned,
        live_streams_count,
        pending_stream_reports,
        pending_bug_reports,
        new_users_count,
        total_categories
      )
      VALUES (
        ${today},
        ${Number(snapshot.total_users_active)},
        ${Number(snapshot.total_users_banned)},
        ${Number(snapshot.live_streams_count)},
        ${Number(snapshot.pending_stream_reports)},
        ${Number(snapshot.pending_bug_reports)},
        ${Number(snapshot.new_users_count)},
        ${Number(snapshot.total_categories)}
      )
      ON CONFLICT (metric_date)
      DO UPDATE SET
        total_users_active = EXCLUDED.total_users_active,
        total_users_banned = EXCLUDED.total_users_banned,
        live_streams_count = EXCLUDED.live_streams_count,
        pending_stream_reports = EXCLUDED.pending_stream_reports,
        pending_bug_reports = EXCLUDED.pending_bug_reports,
        new_users_count = EXCLUDED.new_users_count,
        total_categories = EXCLUDED.total_categories,
        captured_at = NOW()
    `;

    logger.info("[admin-analytics-rollup] Snapshot captured", {
      operation: "captureAdminAnalyticsSnapshot",
      totalUsersActive: Number(snapshot.total_users_active),
      liveStreamsCount: Number(snapshot.live_streams_count),
    });

    return {
      totalUsersActive: Number(snapshot.total_users_active),
      totalUsersBanned: Number(snapshot.total_users_banned),
      liveStreamsCount: Number(snapshot.live_streams_count),
      pendingStreamReports: Number(snapshot.pending_stream_reports),
      pendingBugReports: Number(snapshot.pending_bug_reports),
      newUsersCount: Number(snapshot.new_users_count),
      totalCategories: Number(snapshot.total_categories),
      capturedAt: new Date(),
    };
  } catch (error) {
    logger.error("[admin-analytics-rollup] Failed to capture snapshot", {
      operation: "captureAdminAnalyticsSnapshot",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get current admin analytics from rollup table or compute fresh if needed
 * Prefers recent rollup (< 1 hour old) for performance
 */
export async function getCurrentAdminAnalytics(): Promise<AdminAnalyticsSnapshot> {
  try {
    // Try to get today's rollup (captured less than 1 hour ago)
    const { rows } = await sql`
      SELECT
        total_users_active,
        total_users_banned,
        live_streams_count,
        pending_stream_reports,
        pending_bug_reports,
        new_users_count,
        total_categories,
        captured_at
      FROM admin_analytics_daily_rollup
      WHERE metric_date = CURRENT_DATE
        AND captured_at > NOW() - INTERVAL '1 hour'
      ORDER BY captured_at DESC
      LIMIT 1
    `;

    if (rows.length > 0) {
      const row = rows[0];
      logger.debug("[admin-analytics-rollup] Using cached snapshot", {
        operation: "getCurrentAdminAnalytics",
      });
      return {
        totalUsersActive: Number(row.total_users_active),
        totalUsersBanned: Number(row.total_users_banned),
        liveStreamsCount: Number(row.live_streams_count),
        pendingStreamReports: Number(row.pending_stream_reports),
        pendingBugReports: Number(row.pending_bug_reports),
        newUsersCount: Number(row.new_users_count),
        totalCategories: Number(row.total_categories),
        capturedAt: row.captured_at,
      };
    }

    // No recent rollup, capture fresh
    logger.debug("[admin-analytics-rollup] No recent rollup, capturing fresh", {
      operation: "getCurrentAdminAnalytics",
    });
    return captureAdminAnalyticsSnapshot();
  } catch (error) {
    logger.error("[admin-analytics-rollup] Failed to get current analytics", {
      operation: "getCurrentAdminAnalytics",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get historical trend data for admin dashboard
 * Returns daily snapshots for given date range
 */
export async function getAdminAnalyticsTrend(
  startDate: Date,
  endDate: Date,
  limit: number = 90
): Promise<AdminAnalyticsSnapshot[]> {
  try {
    const { rows } = await sql`
      SELECT
        total_users_active,
        total_users_banned,
        live_streams_count,
        pending_stream_reports,
        pending_bug_reports,
        new_users_count,
        total_categories,
        captured_at
      FROM admin_analytics_daily_rollup
      WHERE metric_date >= ${startDate}
        AND metric_date <= ${endDate}
      ORDER BY metric_date DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      totalUsersActive: Number(row.total_users_active),
      totalUsersBanned: Number(row.total_users_banned),
      liveStreamsCount: Number(row.live_streams_count),
      pendingStreamReports: Number(row.pending_stream_reports),
      pendingBugReports: Number(row.pending_bug_reports),
      newUsersCount: Number(row.new_users_count),
      totalCategories: Number(row.total_categories),
      capturedAt: row.captured_at,
    }));
  } catch (error) {
    logger.error("[admin-analytics-rollup] Failed to get trend data", {
      operation: "getAdminAnalyticsTrend",
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
