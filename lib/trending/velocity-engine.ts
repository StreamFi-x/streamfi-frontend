/**
 * Trending Velocity Engine
 * Computes viewer velocity (rate-of-change) to surface breakout moments
 * rather than just large established channels
 */

import { sql } from '@vercel/postgres';
import { logger } from '@/lib/tracing/logger';

export interface VelocityMetrics {
  user_id: string;
  username: string;
  current_viewers: number;
  velocity_score: number;  // Normalized -1 to 1
  velocity_percent: number;  // Percentage change over window
  velocity_absolute: number;  // Raw viewer delta
  follower_count: number;
  is_live: boolean;
  trend: 'surging' | 'stable' | 'declining';
}

export interface TrendingResult {
  rank: number;
  user: VelocityMetrics;
  reason: string;  // Why this is trending
}

/**
 * Record a viewer snapshot for a channel
 * Called periodically (e.g., every 5 minutes) to track viewer trajectory
 */
export async function recordViewerSnapshot(
  userId: string,
  streamSessionId: string,
  viewerCount: number
): Promise<void> {
  try {
    await sql`
      INSERT INTO viewer_snapshots (user_id, stream_session_id, viewer_count, snapshot_time)
      VALUES (${userId}, ${streamSessionId}, ${viewerCount}, NOW())
    `;

    logger.debug('[trending] Viewer snapshot recorded', {
      operation: 'recordViewerSnapshot',
      userId,
      viewerCount,
    });
  } catch (error) {
    logger.error('[trending] Failed to record viewer snapshot', {
      operation: 'recordViewerSnapshot',
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw — snapshot recording should not break anything
  }
}

/**
 * Compute velocity for a single user over a time window
 * Velocity = (current - average_of_prior_window) / average_of_prior_window
 * Uses two non-overlapping windows for fair comparison
 */
export async function computeUserVelocity(
  userId: string,
  windowHours: number = 24
): Promise<{ current_avg: number; prior_avg: number; velocity_percent: number; velocity_score: number } | null> {
  try {
    const { rows } = await sql`
      WITH time_windows AS (
        SELECT
          -- Current window: last N hours
          NOW() - INTERVAL '${Math.max(1, windowHours)} hours' as current_start,
          NOW() as current_end,
          -- Prior window: N hours before current window
          NOW() - INTERVAL '${windowHours * 2} hours' as prior_start,
          NOW() - INTERVAL '${windowHours} hours' as prior_end
      ),
      current_viewers AS (
        SELECT AVG(viewer_count)::INTEGER as avg_viewers
        FROM viewer_snapshots vs, time_windows tw
        WHERE
          vs.user_id = ${userId}
          AND vs.snapshot_time >= tw.current_start
          AND vs.snapshot_time <= tw.current_end
      ),
      prior_viewers AS (
        SELECT AVG(viewer_count)::INTEGER as avg_viewers
        FROM viewer_snapshots vs, time_windows tw
        WHERE
          vs.user_id = ${userId}
          AND vs.snapshot_time >= tw.prior_start
          AND vs.snapshot_time <= tw.prior_end
      )
      SELECT
        COALESCE(cv.avg_viewers, 0) as current_avg,
        COALESCE(pv.avg_viewers, 1) as prior_avg
      FROM current_viewers cv, prior_viewers pv
    `;

    if (rows.length === 0) return null;

    const { current_avg, prior_avg } = rows[0];

    // Compute percentage change, handling edge cases
    const velocity_percent =
      prior_avg > 0
        ? Math.round(((current_avg - prior_avg) / prior_avg) * 100)
        : current_avg > 0
          ? 100
          : 0;

    // Normalize to -1 to 1 range (clamp to prevent extreme outliers)
    // 100% growth -> 1.0, -100% -> -1.0, stays within [-1, 1]
    const velocity_score = Math.max(-1, Math.min(1, velocity_percent / 100));

    return { current_avg, prior_avg, velocity_percent, velocity_score };
  } catch (error) {
    logger.error('[trending] Failed to compute user velocity', {
      operation: 'computeUserVelocity',
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Compute trending channels using velocity algorithm
 * Returns ranked channels sorted by velocity (breakout moments first)
 * Falls back to follower count for channels with insufficient snapshot data
 */
export async function getTrendingChannels(
  windowHours: number = 24,
  limit: number = 20
): Promise<TrendingResult[]> {
  try {
    // Fetch pre-computed trending results (refreshed by cron job)
    const { rows } = await sql`
      SELECT
        tc.rank,
        u.id,
        u.username,
        tc.current_viewers,
        tc.velocity_score,
        u.follower_count,
        u.is_live,
        tc.last_computed
      FROM trending_channels tc
      JOIN users u ON tc.user_id = u.id
      WHERE
        tc.window_hours = ${windowHours}
        AND tc.last_computed > NOW() - INTERVAL '30 minutes'  -- Only use if recently computed
      ORDER BY tc.rank ASC
      LIMIT ${limit}
    `;

    if (rows.length === 0) {
      logger.warn('[trending] No pre-computed trending results, returning empty', {
        operation: 'getTrendingChannels',
        windowHours,
      });
      return [];
    }

    return rows.map((row: any, index) => ({
      rank: index + 1,
      user: {
        user_id: row.id,
        username: row.username,
        current_viewers: row.current_viewers,
        velocity_score: parseFloat(row.velocity_score),
        velocity_percent: parseFloat(row.velocity_score) * 100,
        velocity_absolute: 0, // Computed separately if needed
        follower_count: row.follower_count,
        is_live: row.is_live,
        trend:
          parseFloat(row.velocity_score) > 0.2
            ? 'surging'
            : parseFloat(row.velocity_score) < -0.2
              ? 'declining'
              : 'stable',
      },
      reason: `${Math.round(parseFloat(row.velocity_score) * 100)}% growth in viewer velocity`,
    }));
  } catch (error) {
    logger.error('[trending] Failed to fetch trending channels', {
      operation: 'getTrendingChannels',
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Refresh trending rankings (cron job)
 * Computes velocity for all live channels and updates materialized results
 * Should run frequently (e.g., every 5-10 minutes) for responsiveness
 */
export async function refreshTrendingRankings(windowHours: number = 24): Promise<number> {
  try {
    logger.info('[trending] Starting ranking refresh', {
      operation: 'refreshTrendingRankings',
      windowHours,
    });

    // Compute velocity for all users with recent snapshots
    const { rows: usersWithSnapshots } = await sql`
      SELECT DISTINCT user_id
      FROM viewer_snapshots
      WHERE snapshot_time > NOW() - INTERVAL '${windowHours * 2} hours'
    `;

    let updated = 0;

    for (const { user_id } of usersWithSnapshots) {
      const velocity = await computeUserVelocity(user_id, windowHours);
      if (!velocity) continue;

      // Update trending_channels table
      await sql`
        INSERT INTO trending_channels (
          user_id,
          rank,  -- Will be recalculated below
          viewer_count,
          velocity_score,
          current_viewers,
          follower_count,
          is_live,
          last_computed,
          window_hours
        )
        SELECT
          ${user_id},
          0,  -- Placeholder, will rank all at once
          ${velocity.current_avg},
          ${velocity.velocity_score},
          u.current_viewers,
          u.follower_count,
          u.is_live,
          NOW(),
          ${windowHours}
        FROM users u
        WHERE u.id = ${user_id}
        ON CONFLICT (user_id, window_hours) DO UPDATE SET
          viewer_count = EXCLUDED.viewer_count,
          velocity_score = EXCLUDED.velocity_score,
          current_viewers = EXCLUDED.current_viewers,
          follower_count = EXCLUDED.follower_count,
          is_live = EXCLUDED.is_live,
          last_computed = NOW()
      `;

      updated++;
    }

    // Now assign final ranks based on velocity (descending)
    await sql`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (ORDER BY velocity_score DESC, current_viewers DESC) as new_rank
        FROM trending_channels
        WHERE window_hours = ${windowHours}
      )
      UPDATE trending_channels tc
      SET rank = r.new_rank
      FROM ranked r
      WHERE tc.id = r.id AND tc.window_hours = ${windowHours}
    `;

    logger.info('[trending] Ranking refresh completed', {
      operation: 'refreshTrendingRankings',
      windowHours,
      updated,
    });

    return updated;
  } catch (error) {
    logger.error('[trending] Failed to refresh trending rankings', {
      operation: 'refreshTrendingRankings',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
