import { NextRequest, NextResponse } from 'next/server';
import { createTraceContext, withTraceContextAsync } from './trace-context';
import { logger } from './logger';

/**
 * High-order function that wraps API route handlers with tracing
 * Extracts trace ID from request headers and establishes trace context
 * for the entire handler execution
 */
export function withTracing(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    // Extract incoming trace ID or generate new one
    const incomingTraceId =
      req.headers.get('x-request-id') ||
      req.headers.get('x-trace-id') ||
      undefined;

    const traceContext = createTraceContext(incomingTraceId);

    return withTraceContextAsync(traceContext, async () => {
      const startTime = Date.now();

      try {
        logger.info('API request started', {
          method: req.method,
          pathname: req.nextUrl.pathname,
          userAgent: req.headers.get('user-agent'),
        });

        const response = await handler(req);

        const durationMs = Date.now() - startTime;
        const status = response.status;

        if (status >= 400) {
          logger.warn('API request failed', {
            method: req.method,
            pathname: req.nextUrl.pathname,
            status,
            durationMs,
          });
        } else {
          logger.info('API request completed', {
            method: req.method,
            pathname: req.nextUrl.pathname,
            status,
            durationMs,
          });
        }

        // Always add trace ID to response headers
        response.headers.set('x-request-id', traceContext.traceId);

        return response;
      } catch (error) {
        const durationMs = Date.now() - startTime;

        logger.error('API request error', {
          method: req.method,
          pathname: req.nextUrl.pathname,
          durationMs,
          errorMessage: error instanceof Error ? error.message : String(error),
        });

        // Return error response with trace ID
        const errorResponse = NextResponse.json(
          {
            error: 'Internal server error',
            requestId: traceContext.traceId,
          },
          { status: 500 }
        );
        errorResponse.headers.set('x-request-id', traceContext.traceId);

        return errorResponse;
      }
    });
  };
}
