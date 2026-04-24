import { EchoResponse } from './types';

const BODY_SIZE_CAP = 10 * 1024; // 10 KB
const TRUNCATION_MARKER = '...[truncated]';

// headers to fully redact
const FULLY_REDACTED_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
]);

//headers to partially redact
const REDACTED_PREFIXES = ['x-api-'];

//checking if a header should be redacted
export function shouldRedactHeader(headerName: string): boolean {
  const lower = headerName.toLowerCase();

  if (FULLY_REDACTED_HEADERS.has(lower)) {
    return true;
  }

  for (const prefix of REDACTED_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

// redact sensitive headers from the request
export function redactHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};

  headers.forEach((value, key) => {
    if (shouldRedactHeader(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  });

  return result;
}

// extracting query parameters from URL
export function extractQueryParams(url: string): Record<string, string | string[]> {
  const parsedUrl = new URL(url);
  const params: Record<string, string | string[]> = {};

  parsedUrl.searchParams.forEach((value, key) => {
    const existing = params[key];
    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        params[key] = [existing, value];
      }
    } else {
      params[key] = value;
    }
  });

  return params;
}

/**
 * parse request body based on content type
 * returns string for non-JSON, parsed object for JSON, null for no body
 */
export async function parseBody(request: Request): Promise<{ body: unknown; truncated: boolean }> {
  const contentLength = request.headers.get('content-length');
  const contentType = request.headers.get('content-type') || '';

  //no body
  if (request.body === null) {
    return { body: null, truncated: false };
  }

  // checking size before reading
  if (contentLength && parseInt(contentLength, 10) > BODY_SIZE_CAP) {
    const text = await request.text();
    return {
      body: text.slice(0, BODY_SIZE_CAP) + TRUNCATION_MARKER,
      truncated: true,
    };
  }

  const text = await request.text();

  if (text.length === 0) {
    return { body: null, truncated: false };
  }
  // truncate if exceeds cap
  if (text.length > BODY_SIZE_CAP) {
    return {
      body: text.slice(0, BODY_SIZE_CAP) + TRUNCATION_MARKER,
      truncated: true,
    };
  }

  //try JSON parse if content-type suggests JSON
  if (contentType.includes('application/json')) {
    try {
      return { body: JSON.parse(text), truncated: false };
    } catch {
      // fall through to return as string if JSON parse fails
    }
  }

  return { body: text, truncated: false };
}

//built the echo response
export async function buildEchoResponse(request: Request): Promise<EchoResponse> {
  const { body, truncated } = await parseBody(request);

  const response: EchoResponse = {
    method: request.method,
    headers: redactHeaders(request.headers),
    query: extractQueryParams(request.url),
    body,
    url: request.url,
    timestamp: new Date().toISOString(),
  };

  if (truncated) {
    response.truncated = true;
  }

  return response;
}