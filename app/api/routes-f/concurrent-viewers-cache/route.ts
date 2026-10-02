import { NextRequest, NextResponse } from 'next/server';
import { getConcurrentViewerCountForDisplay } from '@/lib/analytics/concurrent-viewers';
import { logger } from '@/lib/tracing/logger';

export const runtime = 'nodejs';

/**
 * GET /api/routes-f/concurrent-viewers-cache
 *
 * Returns the platform-wide concurrent viewer count from cache.
 * Cache is refreshed by a background job (cron-update-concurrent-viewers).
 *
 * Response includes:
 * - total_concurrent: Total viewers across all streams right now
 * - by_stream: Breakdown by stream (optional, for future UI features)
 * - last_updated: When the cache was last refreshed
 * - cache_age_seconds: How old the cache value is
 * - is_stale: Whether cache exceeds refresh interval
 *
 * Caching headers: 10 seconds (client caches the response, then re-fetches)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const viewers = await getConcurrentViewerCountForDisplay();

    logger.info('[concurrent-viewers-cache] GET request', {
      operation: 'concurrent-viewers-cache.GET',
      total_concurrent: viewers.total_concurrent,
      cache_age_seconds: viewers.cache_age_seconds,
      is_stale: viewers.is_stale,
    });

    return NextResponse.json(viewers, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=10, s-maxage=10, stale-while-revalidate=60',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    logger.error('[concurrent-viewers-cache] GET error', {
      operation: 'concurrent-viewers-cache.GET',
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch concurrent viewer count',
        total_concurrent: 0,
        by_stream: [],
        last_updated: new Date(),
        cache_age_seconds: -1,
        is_stale: true,
      },
      { status: 500 }
    );
  }
}
