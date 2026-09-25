import { Ratelimit } from "@upstash/ratelimit";
import { NextResponse } from "next/server";
import { getUpstashRedis } from "@/lib/upstash-redis";

// ── Distributed rate limiter (Upstash Redis) ──────────────────────────────────
// When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set (production /
// staging), all instances share a single Redis counter — cold starts don't reset
// the window and distributed deploys can't be bypassed by spreading requests.
//
// Without those env vars (local dev), falls back to an in-memory store so the
// app works with zero setup.
//
// If Redis is configured but errors or times out, the limiter degrades to the
// same per-instance memory store rather than failing open or closed:
// protection weakens to per-instance during an outage, but a Redis blip never
// takes the protected routes down. See docs/rate-limiting.md.
//
// Add to .env.local:
//   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
//   UPSTASH_REDIS_REST_TOKEN=AXxx...
// Get credentials from: https://console.upstash.com/

/** Upstash calls slower than this are treated as unavailable. */
const UPSTASH_TIMEOUT_MS = 1000;
const MEMORY_PRUNE_THRESHOLD = 10_000;

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Unix epoch milliseconds at which the current window resets. */
  resetAt: number;
  retryAfterSeconds: number;
  /** True when the distributed store failed and the memory fallback decided. */
  degraded: boolean;
}

export interface RateLimitOptions {
  /** Redis key namespace; keeps limiters on different routes independent. */
  namespace?: string;
  limit: number;
  windowMs: number;
}

export interface RateLimit {
  check(identity: string): Promise<RateLimitResult>;
}

function toResult(
  success: boolean,
  limit: number,
  remaining: number,
  resetAt: number,
  now: number,
  degraded: boolean
): RateLimitResult {
  return {
    success,
    limit,
    remaining: Math.max(0, remaining),
    resetAt,
    retryAfterSeconds: success
      ? 0
      : Math.max(1, Math.ceil((resetAt - now) / 1000)),
    degraded,
  };
}

function createMemoryWindow(
  limit: number,
  windowMs: number,
  now: () => number
) {
  const store = new Map<string, { count: number; windowStart: number }>();

  return function hit(id: string, degraded: boolean): RateLimitResult {
    const t = now();
    if (store.size > MEMORY_PRUNE_THRESHOLD) {
      for (const [key, entry] of store) {
        if (t - entry.windowStart >= windowMs) {
          store.delete(key);
        }
      }
    }
    let entry = store.get(id);
    if (!entry || t - entry.windowStart >= windowMs) {
      entry = { count: 0, windowStart: t };
      store.set(id, entry);
    }
    entry.count += 1;
    return toResult(
      entry.count <= limit,
      limit,
      limit - entry.count,
      entry.windowStart + windowMs,
      t,
      degraded
    );
  };
}

let warnedNoRedis = false;

/**
 * Builds a reusable limiter. Create it once at module scope and call
 * `check(identity)` per request. Identities should come from server-verified
 * context (session user id, admin id); use IP only for anonymous routes.
 */
export function createRateLimit(
  { namespace, limit, windowMs }: RateLimitOptions,
  { now = () => Date.now() }: { now?: () => number } = {}
): RateLimit {
  const memory = createMemoryWindow(limit, windowMs, now);
  const redis = getUpstashRedis();

  if (!redis) {
    if (!warnedNoRedis) {
      warnedNoRedis = true;
      console.warn(
        "[rate-limit] UPSTASH_REDIS_REST_URL not set — using in-memory fallback. " +
          "Set Upstash env vars for distributed rate limiting in production."
      );
    }
    return { check: async id => memory(id, false) };
  }

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    analytics: false, // disable analytics writes for lower latency
    timeout: UPSTASH_TIMEOUT_MS,
    ...(namespace ? { prefix: `ratelimit:${namespace}` } : {}),
  });

  return {
    async check(id) {
      try {
        const res = await limiter.limit(id);
        if (res.reason !== "timeout") {
          return toResult(
            res.success,
            res.limit,
            res.remaining,
            res.reset,
            now(),
            false
          );
        }
        console.error(
          `[rate-limit] Upstash timed out (${namespace ?? "default"})`
        );
      } catch (err) {
        console.error(
          `[rate-limit] Upstash failed (${namespace ?? "default"}):`,
          err
        );
      }
      return memory(id, true);
    },
  };
}

/**
 * Returns an async rate-limit checker for the given window + limit.
 * Call once at module level per route; invoke on every request.
 *
 * @param windowMs  Sliding window duration in milliseconds
 * @param max       Maximum allowed requests per window per identifier
 */
export function createRateLimiter(windowMs: number, max: number) {
  const limiter = createRateLimit({ limit: max, windowMs });
  return async function isRateLimited(id: string): Promise<boolean> {
    return !(await limiter.check(id)).success;
  };
}

export function rateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

/** Standard 429 in the API's `{ error }` shape, with retry guidance. */
export function tooManyRequests(
  result: RateLimitResult,
  message = "Too many requests"
): NextResponse {
  return NextResponse.json(
    { error: message, retryAfter: result.retryAfterSeconds },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "Cache-Control": "private, no-store",
        ...rateLimitHeaders(result),
      },
    }
  );
}
