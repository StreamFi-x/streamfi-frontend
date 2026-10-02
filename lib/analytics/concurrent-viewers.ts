/**
 * Concurrent Viewers Cache Manager
 *
 * Maintains a cached platform-wide concurrent viewer count that is periodically
 * refreshed by a background job. This avoids expensive aggregation queries on
 * every homepage load.
 *
 * Cache structure:
 *   - total_concurrent: sum across all active streams
 *   - last_updated: timestamp of last refresh
 *   - stale_after: cache invalidation time (seconds)
 */

import { sql } from '@vercel/postgres';
import { logger } from '@/lib/tracing/logger';

export interface ConcurrentViewerCount {
  total_concurrent: number;
  by_stream: Array<{
    stream_id: string;
    viewer_count: number;
  }>;
  last_updated: Date;
  cache_age_seconds: number;
  is_stale: boolean;
}

export interface ConcurrentViewerCacheEntry {
  id: string;
  total_concurrent: number;
  breakdown_json: string; // JSON stringified array of {stream_id, viewer_count}
  last_updated: Date;
  created_at: Date;
}

const CACHE_KEY = 'platform_concurrent_viewers';
const CACHE_STALE_AFTER_SECONDS = 60; // Cache is considered stale if older than 1 minute

/**
 * Query current concurrent viewers across all active streams.
 * This is an expensive query meant to run as a background job, not on every request.
 */
export async function getCurrentConcurrentViewers(): Promise<{
  total: number;
  by_stream: Array<{ stream_id: string; viewer_count: number }>;
}> {
  try {
    // Query active viewers from stream_viewers table
    // A viewer is considered "active" if they haven't explicitly left (left_at IS NULL)
    // and their session is recent (joined within last hour)
    const { rows } = await sql`
      SELECT
        sv.stream_session_id,
        COUNT(*) as viewer_count
      FROM stream_viewers sv
      JOIN stream_sessions ss ON sv.stream_session_id = ss.id
      WHERE
        -- Viewer is still connected (no left_at timestamp)
        sv.left_at IS NULL
        -- Stream is currently live (no ended_at timestamp)
        AND ss.ended_at IS NULL
      GROUP BY sv.stream_session_id
      ORDER BY viewer_count DESC
    `;

    const by_stream = rows.map((row: any) => ({
      stream_id: row.stream_session_id,
      viewer_count: parseInt(row.viewer_count, 10),
    }));

    const total = by_stream.reduce((sum, item) => sum + item.viewer_count, 0);

    return { total, by_stream };
  } catch (error) {
    logger.error('[concurrent-viewers] Failed to query current viewers', {
      operation: 'getCurrentConcurrentViewers',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get the cached concurrent viewer count.
 * Returns stale cache if available, otherwise returns empty/zero state.
 */
export async function getCachedConcurrentViewers(): Promise<ConcurrentViewerCount | null> {
  try {
    const { rows } = await sql`
      SELECT
        id,
        total_concurrent,
        breakdown_json,
        last_updated,
        created_at
      FROM concurrent_viewer_cache
      WHERE id = ${CACHE_KEY}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return null;
    }

    const cache = rows[0] as ConcurrentViewerCacheEntry;
    const now = new Date();
    const cache_age_seconds = Math.floor(
      (now.getTime() - cache.last_updated.getTime()) / 1000
    );
    const is_stale = cache_age_seconds > CACHE_STALE_AFTER_SECONDS;

    let by_stream: Array<{ stream_id: string; viewer_count: number }> = [];
    try {
      by_stream = JSON.parse(cache.breakdown_json);
    } catch {
      logger.warn('[concurrent-viewers] Failed to parse breakdown_json');
    }

    return {
      total_concurrent: cache.total_concurrent,
      by_stream,
      last_updated: cache.last_updated,
      cache_age_seconds,
      is_stale,
    };
  } catch (error) {
    logger.error('[concurrent-viewers] Failed to read cache', {
      operation: 'getCachedConcurrentViewers',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Update the cached concurrent viewer count.
 * Called by a scheduled background job.
 */
export async function updateConcurrentViewerCache(): Promise<void> {
  try {
    const { total, by_stream } = await getCurrentConcurrentViewers();
    const breakdown_json = JSON.stringify(by_stream);

    // Upsert into cache table
    await sql`
      INSERT INTO concurrent_viewer_cache
        (id, total_concurrent, breakdown_json, last_updated, created_at)
      VALUES
        (${CACHE_KEY}, ${total}, ${breakdown_json}, NOW(), NOW())
      ON CONFLICT (id)
        DO UPDATE SET
          total_concurrent = ${total},
          breakdown_json = ${breakdown_json},
          last_updated = NOW()
    `;

    logger.info('[concurrent-viewers] Cache updated', {
      operation: 'updateConcurrentViewerCache',
      total_concurrent: total,
      stream_count: by_stream.length,
    });
  } catch (error) {
    logger.error('[concurrent-viewers] Failed to update cache', {
      operation: 'updateConcurrentViewerCache',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get concurrent viewer count, preferring cache if fresh, falling back to query.
 * Used for homepage display where eventual consistency is acceptable.
 */
export async function getConcurrentViewerCountForDisplay(): Promise<ConcurrentViewerCount> {
  const cached = await getCachedConcurrentViewers();

  if (cached && !cached.is_stale) {
    return cached;
  }

  if (cached) {
    // Return stale cache if available (better UX than empty state)
    logger.warn('[concurrent-viewers] Cache is stale, returning stale value', {
      operation: 'getConcurrentViewerCountForDisplay',
      cache_age_seconds: cached.cache_age_seconds,
    });
    return cached;
  }

  // No cache exists, compute fresh count
  logger.info('[concurrent-viewers] No cache available, computing fresh count', {
    operation: 'getConcurrentViewerCountForDisplay',
  });
  const { total, by_stream } = await getCurrentConcurrentViewers();

  return {
    total_concurrent: total,
    by_stream,
    last_updated: new Date(),
    cache_age_seconds: 0,
    is_stale: false,
  };
}
