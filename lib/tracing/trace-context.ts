import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

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

const asyncLocalStorage = new AsyncLocalStorage<TraceContext>();

/**
 * Generate a new trace context
 */
export function createTraceContext(
  traceId?: string,
  parentSpanId?: string
): TraceContext {
  return {
    traceId: traceId || `trace-${randomUUID()}`,
    spanId: `span-${randomUUID()}`,
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
  return context?.traceId || `trace-${randomUUID()}`;
}

/**
 * Propagate trace context to headers for outbound requests
 */
export function getTraceHeaders(): Record<string, string> {
  const context = getCurrentTraceContext();
  if (!context) {
    return {
      'x-request-id': `trace-${randomUUID()}`,
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
