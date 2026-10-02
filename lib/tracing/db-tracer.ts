import { getCurrentTraceContext } from './trace-context';
import { logger } from './logger';

/**
 * Adds trace context as a SQL comment to a query for logging/debugging in the database
 * @param query - The SQL query string
 * @returns Query with appended trace context comment
 */
export function addTraceComment(query: string): string {
  const context = getCurrentTraceContext();
  if (!context) {
    return query;
  }

  // Append trace info as SQL comment (useful for DB logs and query analysis)
  const comment = `/* trace_id=${context.traceId} span_id=${context.spanId} */`;
  return query + ' ' + comment;
}

/**
 * Log database query execution with trace context
 */
export function logDbQuery(
  operation: string,
  query?: string,
  error?: Error | null
): void {
  if (error) {
    logger.error('Database query failed', {
      operation,
      query: query?.substring(0, 200),
      errorMessage: error.message,
    });
  } else {
    logger.debug('Database query executed', {
      operation,
      query: query?.substring(0, 200),
    });
  }
}
