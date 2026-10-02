import { getTraceHeaders } from './trace-context';
import { logger } from './logger';

export interface TracedFetchOptions extends RequestInit {
  serviceName?: string;
  operation?: string;
}

/**
 * Wrapper around fetch that automatically propagates trace headers
 * and logs the request/response with trace context
 */
export async function tracedFetch<T = any>(
  url: string,
  options: TracedFetchOptions = {}
): Promise<T> {
  const { serviceName = 'external-api', operation = 'request', ...fetchOpts } = options;

  // Merge trace headers into request headers
  const headers = {
    ...fetchOpts.headers,
    ...getTraceHeaders(),
  };

  const startTime = Date.now();

  logger.debug('Outbound request initiated', {
    service: serviceName,
    operation,
    url: url.split('?')[0], // URL without query params for privacy
    method: fetchOpts.method || 'GET',
  });

  try {
    const response = await fetch(url, {
      ...fetchOpts,
      headers,
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      logger.warn('Outbound request failed', {
        service: serviceName,
        operation,
        status: response.status,
        durationMs,
      });
    } else {
      logger.debug('Outbound request succeeded', {
        service: serviceName,
        operation,
        status: response.status,
        durationMs,
      });
    }

    // Parse response based on content-type
    const contentType = response.headers.get('content-type');
    let data: T;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text() as any;
    }

    if (!response.ok) {
      throw new Error(
        `${serviceName} API error: ${response.status} ${response.statusText}`
      );
    }

    return data;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Outbound request error', {
      service: serviceName,
      operation,
      durationMs,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Add trace headers to a fetch options object
 */
export function withTraceHeaders(options: RequestInit = {}): RequestInit {
  return {
    ...options,
    headers: {
      ...options.headers,
      ...getTraceHeaders(),
    },
  };
}
