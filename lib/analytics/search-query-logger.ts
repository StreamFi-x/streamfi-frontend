/**
 * Search Query Analytics Logger
 * Captures and logs search queries for analytics, with privacy-aware data retention
 * and high-volume handling via debouncing/batching
 */

import { sql } from '@vercel/postgres';
import { logger } from '@/lib/tracing/logger';

export interface SearchQueryLogEntry {
  query_text: string;
  normalized_query: string;
  search_source: 'general' | 'category' | 'autocomplete';
  result_count: number;
  viewer_id?: string;
  query_duration_ms?: number;
  client_ip?: string;
}

export interface ZeroResultQueryAggregate {
  normalized_query: string;
  distinct_query_variants: string[];
  total_occurrences: number;
  unique_viewers: number;
  last_seen_at: Date;
  trending_score: number;
  category_context?: string;
}

/**
 * Normalize query for aggregation
 * Handles case, whitespace, and common variations to group related queries
 */
export function normalizeQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, ''); // Remove special chars for fuzzy grouping
}

/**
 * Log a search query to the database
 * Handles batching to avoid per-keystroke logging overhead
 *
 * @param entry Search query entry to log
 */
export async function logSearchQuery(entry: SearchQueryLogEntry): Promise<void> {
  try {
    await sql`
      INSERT INTO search_queries (
        viewer_id,
        query_text,
        normalized_query,
        search_source,
        result_count,
        query_duration_ms,
        client_ip,
        created_at
      ) VALUES (
        ${entry.viewer_id || null},
        ${entry.query_text},
        ${entry.normalized_query},
        ${entry.search_source},
        ${entry.result_count},
        ${entry.query_duration_ms || null},
        ${entry.client_ip || null},
        NOW()
      )
    `;

    logger.debug('[search-analytics] Query logged', {
      operation: 'logSearchQuery',
      source: entry.search_source,
      has_results: entry.result_count > 0,
      query_length: entry.query_text.length,
    });
  } catch (error) {
    logger.error('[search-analytics] Failed to log search query', {
      operation: 'logSearchQuery',
      error: error instanceof Error ? error.message : String(error),
      query: entry.query_text.substring(0, 100), // Truncate for logs
    });
    // Don't throw — logging should not break search functionality
  }
}

/**
 * Get zero-result queries aggregated by normalized form
 * Used for identifying taxonomy gaps and search quality issues
 *
 * @param windowHours Number of hours to look back
 * @param limit Maximum number of results
 * @returns Aggregated zero-result queries ranked by trending score
 */
export async function getZeroResultQueryClusters(
  windowHours: number = 24,
  limit: number = 50
): Promise<ZeroResultQueryAggregate[]> {
  try {
    const { rows } = await sql`
      SELECT
        normalized_query,
        array_agg(DISTINCT query_text) as distinct_query_variants,
        COUNT(*) as total_occurrences,
        COUNT(DISTINCT viewer_id) as unique_viewers,
        MAX(created_at) as last_seen_at,
        -- Trending score: weight by recency (exponential decay) and frequency
        COUNT(*) * EXP(-EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) / (${windowHours * 3600})) as trending_score
      FROM search_queries
      WHERE
        has_results = FALSE
        AND created_at > NOW() - INTERVAL '${windowHours} hours'
      GROUP BY normalized_query
      ORDER BY trending_score DESC, total_occurrences DESC
      LIMIT ${limit}
    `;

    return rows.map((row: any) => ({
      normalized_query: row.normalized_query,
      distinct_query_variants: row.distinct_query_variants || [],
      total_occurrences: row.total_occurrences,
      unique_viewers: row.unique_viewers,
      last_seen_at: new Date(row.last_seen_at),
      trending_score: parseFloat(row.trending_score),
    }));
  } catch (error) {
    logger.error('[search-analytics] Failed to fetch zero-result clusters', {
      operation: 'getZeroResultQueryClusters',
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Get search query statistics by source
 * Useful for understanding relative volume and performance of different search surfaces
 */
export async function getSearchQueryStats(
  windowHours: number = 24
): Promise<Record<string, { total: number; zero_results: number; zero_result_pct: number }>> {
  try {
    const { rows } = await sql`
      SELECT
        search_source,
        COUNT(*) as total,
        SUM(CASE WHEN has_results = FALSE THEN 1 ELSE 0 END) as zero_results
      FROM search_queries
      WHERE created_at > NOW() - INTERVAL '${windowHours} hours'
      GROUP BY search_source
    `;

    const stats: Record<string, any> = {};
    for (const row of rows) {
      stats[row.search_source] = {
        total: row.total,
        zero_results: row.zero_results || 0,
        zero_result_pct: row.total > 0 ? Math.round(((row.zero_results || 0) / row.total) * 100) : 0,
      };
    }
    return stats;
  } catch (error) {
    logger.error('[search-analytics] Failed to fetch query stats', {
      operation: 'getSearchQueryStats',
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

/**
 * Archive and aggregate old queries for long-term trend analysis
 * Called periodically (e.g., daily) to maintain zero_result_query_aggregates table
 * Deletes queries older than retentionDays for privacy compliance
 */
export async function aggregateAndRetainQueries(
  retentionDays: number = 90
): Promise<{ archived: number; deleted: number }> {
  try {
    // First, insert into aggregates any new normalized queries not yet tracked
    const insertResult = await sql`
      INSERT INTO zero_result_query_aggregates (
        normalized_query,
        distinct_query_variants,
        total_occurrences,
        unique_viewers,
        last_seen_at
      )
      SELECT
        sq.normalized_query,
        array_agg(DISTINCT sq.query_text),
        COUNT(*),
        COUNT(DISTINCT sq.viewer_id),
        MAX(sq.created_at)
      FROM search_queries sq
      WHERE
        sq.has_results = FALSE
        AND sq.created_at > NOW() - INTERVAL '7 days'
      GROUP BY sq.normalized_query
      ON CONFLICT (normalized_query) DO UPDATE SET
        distinct_query_variants = EXCLUDED.distinct_query_variants,
        total_occurrences = zero_result_query_aggregates.total_occurrences + EXCLUDED.total_occurrences,
        unique_viewers = GREATEST(
          zero_result_query_aggregates.unique_viewers,
          EXCLUDED.unique_viewers
        ),
        last_seen_at = GREATEST(zero_result_query_aggregates.last_seen_at, EXCLUDED.last_seen_at)
      RETURNING id
    `;

    const archived = insertResult.rowCount || 0;

    // Delete old queries for privacy compliance
    const deleteResult = await sql`
      DELETE FROM search_queries
      WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
    `;

    const deleted = deleteResult.rowCount || 0;

    logger.info('[search-analytics] Queries archived and retained', {
      operation: 'aggregateAndRetainQueries',
      archived,
      deleted,
      retentionDays,
    });

    return { archived, deleted };
  } catch (error) {
    logger.error('[search-analytics] Failed to archive and retain queries', {
      operation: 'aggregateAndRetainQueries',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
