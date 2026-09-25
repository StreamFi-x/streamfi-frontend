/**
 * Trace context stored in AsyncLocalStorage (on Node/server environments).
 * Provides request-scoped correlation ID and trace metadata.
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  timestamp: number;
}

// Safely obtain AsyncLocalStorage only in server-side environments so browser bundles succeed
interface LocalStorageLike<T> {
  run<R>(store: T, callback: () => R): R;
  getStore(): T | undefined;
}

let asyncLocalStorage: LocalStorageLike<TraceContext> | null = null;
if (typeof window === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AsyncLocalStorage } = require("async_hooks");
    asyncLocalStorage = new AsyncLocalStorage();
  } catch {
    // Environment does not support async_hooks
  }
}

function getUuid(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Generate a new trace context
 */
export function createTraceContext(
  traceId?: string,
  parentSpanId?: string
): TraceContext {
  return {
    traceId: traceId || `trace-${getUuid()}`,
    spanId: `span-${getUuid()}`,
    parentSpanId,
    timestamp: Date.now(),
  };
}

/**
 * Run a function within a trace context
 */
export function withTraceContext<T>(
  context: TraceContext,
  fn: () => T
): T {
  if (asyncLocalStorage) {
    return asyncLocalStorage.run(context, fn);
  }
  return fn();
}

/**
 * Run async function within a trace context
 */
export async function withTraceContextAsync<T>(
  context: TraceContext,
  fn: () => Promise<T>
): Promise<T> {
  if (asyncLocalStorage) {
    return asyncLocalStorage.run(context, fn);
  }
  return fn();
}

/**
 * Get current trace context (returns undefined if not in a traced context)
 */
export function getCurrentTraceContext(): TraceContext | undefined {
  if (asyncLocalStorage) {
    return asyncLocalStorage.getStore();
  }
  return undefined;
}

/**
 * Get trace ID from current context or generate one
 */
export function getTraceId(): string {
  const context = getCurrentTraceContext();
  return context?.traceId || `trace-${getUuid()}`;
}

/**
 * Propagate trace context to headers for outbound requests
 */
export function getTraceHeaders(): Record<string, string> {
  const context = getCurrentTraceContext();
  if (!context) {
    return {
      "x-request-id": `trace-${getUuid()}`,
    };
  }

  return {
    "x-request-id": context.traceId,
    "x-trace-id": context.traceId,
    "x-span-id": context.spanId,
    "x-parent-span-id": context.parentSpanId || context.spanId,
  };
}

/**
 * Format trace context for structured logging
 */
export function formatTraceContext(context?: TraceContext): Record<string, string> {
  const ctx = context || getCurrentTraceContext();
  if (!ctx) {
    return {};
  }

  return {
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    ...(ctx.parentSpanId && { parentSpanId: ctx.parentSpanId }),
  };
}
