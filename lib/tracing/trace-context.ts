/**
 * Trace context stored in AsyncLocalStorage.
 * Provides request-scoped correlation ID and trace metadata.
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  timestamp: number;
}

type ALS<T> = {
  run<R>(store: T, callback: () => R): R;
  getStore(): T | undefined;
};

class FallbackAsyncLocalStorage<T> implements ALS<T> {
  private current: T | undefined = undefined;
  run<R>(store: T, callback: () => R): R {
    const prev = this.current;
    this.current = store;
    try {
      return callback();
    } finally {
      this.current = prev;
    }
  }
  getStore(): T | undefined {
    return this.current;
  }
}

function createALS<T>(): ALS<T> {
  if (typeof (globalThis as unknown as { AsyncLocalStorage?: new () => ALS<T> }).AsyncLocalStorage !== 'undefined') {
    const G = (globalThis as unknown as { AsyncLocalStorage: new () => ALS<T> });
    return new G.AsyncLocalStorage();
  }
  try {
    // Use dynamic require so bundlers do not attempt to bundle async_hooks in browser/edge
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeHooks = require('async_hooks');
    if (nodeHooks?.AsyncLocalStorage) {
      return new nodeHooks.AsyncLocalStorage();
    }
  } catch {
    // Browser / Edge fallback
  }
  return new FallbackAsyncLocalStorage<T>();
}

const asyncLocalStorage = createALS<TraceContext>();

function safeUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Generate a new trace context
 */
export function createTraceContext(
  traceId?: string,
  parentSpanId?: string
): TraceContext {
  return {
    traceId: traceId || `trace-${safeUUID()}`,
    spanId: `span-${safeUUID()}`,
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
  return asyncLocalStorage.run(context, fn);
}

/**
 * Run async function within a trace context
 */
export async function withTraceContextAsync<T>(
  context: TraceContext,
  fn: () => Promise<T>
): Promise<T> {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Get current trace context (returns undefined if not in a traced context)
 */
export function getCurrentTraceContext(): TraceContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Get trace ID from current context or generate one
 */
export function getTraceId(): string {
  const context = getCurrentTraceContext();
  return context?.traceId || `trace-${safeUUID()}`;
}

/**
 * Propagate trace context to headers for outbound requests
 */
export function getTraceHeaders(): Record<string, string> {
  const context = getCurrentTraceContext();
  if (!context) {
    return {
      'x-request-id': `trace-${safeUUID()}`,
    };
  }

  return {
    'x-request-id': context.traceId,
    'x-trace-id': context.traceId,
    'x-span-id': context.spanId,
    'x-parent-span-id': context.parentSpanId || context.spanId,
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
