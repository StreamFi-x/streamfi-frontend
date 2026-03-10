import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ── Distributed rate limiter (Upstash Redis) ──────────────────────────────────
// When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set (production /
// staging), all instances share a single Redis counter — cold starts don't reset
// the window and distributed deploys can't be bypassed by spreading requests.
//
// Without those env vars (local dev), falls back to an in-memory store so the
// app works with zero setup.
//
// Add to .env.local:
//   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
//   UPSTASH_REDIS_REST_TOKEN=AXxx...
// Get credentials from: https://console.upstash.com/

const hasRedis =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

// Lazy singleton — created once when first rate limiter is built
let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

// In-memory fallback for local development
function createMemoryLimiter(windowMs: number, max: number) {
  const store = new Map<string, { count: number; windowStart: number }>();
  return async function isRateLimited(id: string): Promise<boolean> {
    const now = Date.now();
    const entry = store.get(id);
    if (!entry || now - entry.windowStart > windowMs) {
      store.set(id, { count: 1, windowStart: now });
      return false;
    }
    entry.count += 1;
    return entry.count > max;
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
  if (!hasRedis) {
    // Local dev: warn once, then use memory store
    console.warn(
      "[rate-limit] UPSTASH_REDIS_REST_URL not set — using in-memory fallback. " +
        "Set Upstash env vars for distributed rate limiting in production."
    );
    return createMemoryLimiter(windowMs, max);
  }

  const limiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(max, `${windowMs}ms`),
    analytics: false, // disable analytics writes for lower latency
  });

  return async function isRateLimited(id: string): Promise<boolean> {
    const { success } = await limiter.limit(id);
    return !success;
  };
}
