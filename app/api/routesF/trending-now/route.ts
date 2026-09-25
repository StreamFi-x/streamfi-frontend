/**
 * Trending Now Endpoint
 * Returns channels sorted by viewer velocity (rate-of-change) not raw viewer count
 * Surfaces breakout moments and viral growth, not just established large channels
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTrendingChannels } from '@/lib/trending/velocity-engine';
import { logger } from '@/lib/tracing/logger';

/**
 * GET /api/routesF/trending-now
 * Query parameters:
 *   - window: time window in hours for velocity calculation (default: 24)
 *   - limit: max results (default: 20)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const windowHours = Math.min(parseInt(searchParams.get('window') || '24', 10), 168); // Max 1 week
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    const trending = await getTrendingChannels(windowHours, limit);

    logger.debug('[trending-now] Request completed', {
      operation: 'getTrendingNow',
      windowHours,
      results: trending.length,
    });

    return NextResponse.json(
      {
        window: { hours: windowHours },
        trending: trending.map(t => ({
          rank: t.rank,
          user_id: t.user.user_id,
          username: t.user.username,
          follower_count: t.user.follower_count,
          is_live: t.user.is_live,
          current_viewers: t.user.current_viewers,
          velocity_score: t.user.velocity_score,
          velocity_percent: t.user.velocity_percent,
          trend: t.user.trend,
          reason: t.reason,
        })),
        summary: {
          total_results: trending.length,
          top_trending: trending[0]?.user.username || null,
          computation_window_hours: windowHours,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60', // 5 min cache
        },
      }
    );
  } catch (error) {
    logger.error('[trending-now] Request failed', {
      operation: 'getTrendingNow',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch trending channels' }, { status: 500 });
  }
}
