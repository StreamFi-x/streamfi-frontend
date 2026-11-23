/**
 * Correlation IDs tie together the separate API calls of one logical user
 * action (for example a tip: quote, wallet signature, refresh of totals).
 *
 * The client generates one ID per action and sends it in CORRELATION_HEADER on
 * every related call. Servers accept it (only if well formed), put it in the
 * trace context so every log line carries `correlationId`, and echo it back.
 * It is distinct from the per-request trace ID: one action has one correlation
 * ID and many request/trace IDs.
 */

export const CORRELATION_HEADER = "x-correlation-id";

const CORRELATION_PREFIX = "corr-";
/** Letters, digits, dash and underscore only, so the value is safe in logs. */
const CORRELATION_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function randomId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return (Math.random().toString(36).slice(2) + Date.now().toString(36)).padEnd(
    16,
    "0"
  );
}

export function createCorrelationId(): string {
  return `${CORRELATION_PREFIX}${randomId()}`;
}

export function isValidCorrelationId(value: unknown): value is string {
  return typeof value === "string" && CORRELATION_PATTERN.test(value);
}

/**
 * Reads a correlation ID from request headers. Returns undefined when it is
 * missing or malformed, so a client cannot inject arbitrary text into logs.
 */
export function readCorrelationId(headers: {
  get(name: string): string | null;
}): string | undefined {
  const value = headers.get(CORRELATION_HEADER);
  return isValidCorrelationId(value) ? value : undefined;
}

/** Merges the correlation header into a fetch `headers` init. */
export function withCorrelationHeader(
  correlationId: string,
  headers?: HeadersInit
): Headers {
  const merged = new Headers(headers);
  merged.set(CORRELATION_HEADER, correlationId);
  return merged;
}
