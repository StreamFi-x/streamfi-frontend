/**
 * Cache Invalidation Manager
 * Ties cache invalidation to live-status changes and other user updates
 * Uses tag-based invalidation to purge only affected cache entries
 */

import { sql } from '@vercel/postgres';
import { logger } from '@/lib/tracing/logger';

export type CacheInvalidationEvent = 'live_status_change' | 'user_update' | 'follower_change' | 'manual_purge';

interface InvalidationEntry {
  cache_key: string;
  user_id: string;
  tag_type: string;
}

// In-memory cache store reference (shared with search-cache)
// In production, replace with Redis or other distributed cache
let cacheStore: Map<string, { data: any; expiresAt: number }> = new Map();

/**
 * Register cache entries with user ID tags for later invalidation
 * When a user's live status changes, we can find and purge all affected cache entries
 */
export async function tagCacheEntry(
  cacheKey: string,
  userId: string,
  tagType: 'user' | 'stream' | 'category' = 'user'
): Promise<void> {
  try {
    // Persist tag relationship to database for distributed/multi-instance environments
    await sql`
      INSERT INTO search_cache_tags (cache_key, user_id, tag_type)
      VALUES (${cacheKey}, ${userId}, ${tagType})
      ON CONFLICT DO NOTHING
    `;

    logger.debug('[cache-invalidation] Cache entry tagged', {
      operation: 'tagCacheEntry',
      cacheKey,
      userId,
      tagType,
    });
  } catch (error) {
    logger.error('[cache-invalidation] Failed to tag cache entry', {
      operation: 'tagCacheEntry',
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw — tagging should not break cache operations
  }
}

/**
 * Invalidate all cache entries associated with a user
 * Called when user's live status changes, username updates, etc.
 */
export async function invalidateCacheForUser(
  userId: string,
  event: CacheInvalidationEvent,
  reason: string = ''
): Promise<number> {
  try {
    logger.info('[cache-invalidation] Starting cache invalidation', {
      operation: 'invalidateCacheForUser',
      userId,
      event,
      reason,
    });

    // Fetch all cache keys tagged with this user
    const { rows } = await sql`
      SELECT DISTINCT cache_key
      FROM search_cache_tags
      WHERE user_id = ${userId}
    `;

    const affectedKeys = rows.map((row: any) => row.cache_key);

    // Invalidate in local memory cache
    let localInvalidated = 0;
    for (const key of affectedKeys) {
      if (cacheStore.has(key)) {
        cacheStore.delete(key);
        localInvalidated++;
      }
    }

    // Record invalidation event for audit trail
    await sql`
      INSERT INTO cache_invalidation_log (event_type, affected_user_id, cache_keys_invalidated, reason)
      VALUES (${event}, ${userId}, ${JSON.stringify(affectedKeys)}, ${reason})
    `;

    // Clean up old tags (optional: keep for 7 days then remove)
    await sql`
      DELETE FROM search_cache_tags
      WHERE user_id = ${userId}
        AND created_at < NOW() - INTERVAL '7 days'
    `;

    logger.info('[cache-invalidation] Cache invalidation completed', {
      operation: 'invalidateCacheForUser',
      userId,
      event,
      affectedKeys: affectedKeys.length,
      localInvalidated,
    });

    return affectedKeys.length;
  } catch (error) {
    logger.error('[cache-invalidation] Failed to invalidate cache', {
      operation: 'invalidateCacheForUser',
      userId,
      event,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw — invalidation should not break user operations
    return 0;
  }
}

/**
 * Hook: Called when user goes live/offline
 * Invalidates search cache for that user so live status is reflected immediately
 */
export async function onLiveStatusChange(userId: string, isLive: boolean): Promise<void> {
  const reason = isLive ? 'User went live' : 'User went offline';
  await invalidateCacheForUser(userId, 'live_status_change', reason);
}

/**
 * Hook: Called when user updates profile info that affects search
 * (username, follower count, tags, etc.)
 */
export async function onUserProfileUpdate(
  userId: string,
  updatedFields: string[]
): Promise<void> {
  if (updatedFields.some(f => ['username', 'bio', 'avatar', 'categories'].includes(f))) {
    const reason = `Updated: ${updatedFields.join(', ')}`;
    await invalidateCacheForUser(userId, 'user_update', reason);
  }
}

/**
 * Hook: Called when user gains/loses followers
 * May affect ranking in search results
 */
export async function onFollowerChange(userId: string, newFollowerCount: number): Promise<void> {
  const reason = `Follower count changed to ${newFollowerCount}`;
  await invalidateCacheForUser(userId, 'follower_change', reason);
}

/**
 * Get recent invalidation events for a user
 * Useful for debugging cache issues
 */
export async function getInvalidationHistory(
  userId: string,
  limitHours: number = 24
): Promise<
  Array<{
    event_type: string;
    reason: string;
    triggered_at: Date;
    cache_keys_invalidated: number;
  }>
> {
  try {
    const { rows } = await sql`
      SELECT
        event_type,
        reason,
        triggered_at,
        array_length(cache_keys_invalidated, 1) as cache_keys_invalidated
      FROM cache_invalidation_log
      WHERE
        affected_user_id = ${userId}
        AND triggered_at > NOW() - INTERVAL '${limitHours} hours'
      ORDER BY triggered_at DESC
      LIMIT 100
    `;

    return rows.map((row: any) => ({
      event_type: row.event_type,
      reason: row.reason,
      triggered_at: new Date(row.triggered_at),
      cache_keys_invalidated: row.cache_keys_invalidated || 0,
    }));
  } catch (error) {
    logger.error('[cache-invalidation] Failed to fetch invalidation history', {
      operation: 'getInvalidationHistory',
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Set the in-memory cache store reference
 * Allows this module to invalidate the actual cache used by search endpoints
 */
export function setCacheStore(store: Map<string, { data: any; expiresAt: number }>): void {
  cacheStore = store;
  logger.debug('[cache-invalidation] Cache store reference set');
}
