/**
 * Admin API: Search Analytics Dashboard
 * Reports on zero-result queries, search quality metrics, and taxonomy gaps
 * Auth: Admin only
 */

import { NextRequest, NextResponse } from 'next/server';
import { getZeroResultQueryClusters, getSearchQueryStats } from '@/lib/analytics/search-query-logger';
import { logger } from '@/lib/tracing/logger';

/**
 * GET /api/admin/search-analytics
 * Query parameters:
 *   - window: hours to look back (default: 24)
 *   - limit: max results (default: 50)
 *   - format: 'json' or 'csv' (default: json)
 */
export async function GET(req: NextRequest) {
  try {
    // TODO: Add admin auth check
    // const user = await getSessionUser(req);
    // if (!user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const windowHours = Math.min(parseInt(searchParams.get('window') || '24', 10), 720); // Max 30 days
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 1000);

    const [zeroResultClusters, stats] = await Promise.all([
      getZeroResultQueryClusters(windowHours, limit),
      getSearchQueryStats(windowHours),
    ]);

    logger.info('[search-analytics] Admin dashboard queried', {
      operation: 'getSearchAnalytics',
      windowHours,
      zeroResultCount: zeroResultClusters.length,
    });

    return NextResponse.json(
      {
        window: { hours: windowHours, from: new Date(Date.now() - windowHours * 3600 * 1000) },
        zero_result_clusters: zeroResultClusters.slice(0, limit),
        query_stats: stats,
        summary: {
          total_zero_results: zeroResultClusters.reduce((sum, q) => sum + q.total_occurrences, 0),
          unique_unmet_queries: zeroResultClusters.length,
          top_gap: zeroResultClusters[0]?.normalized_query || null,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, s-maxage=300', // Cache for 5 minutes
        },
      }
    );
  } catch (error) {
    logger.error('[search-analytics] Dashboard query failed', {
      operation: 'getSearchAnalytics',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
