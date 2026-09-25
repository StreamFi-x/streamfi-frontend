import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";
import {
  validateApiKey,
  ApiKeyTier,
  ANONYMOUS_IP_LIMIT_PER_MIN,
} from "./api-keys";

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

// ── Rate-Limit Tiering Engine ──────────────────────────────────────────────────

export interface TieredRateLimitResult {
  allowed: boolean;
  tier: "anonymous" | ApiKeyTier;
  limit: number;
  remaining: number;
  keyId?: string;
  userId?: string;
  errorResponse?: NextResponse;
  headers: Record<string, string>;
}

export function extractApiKeyFromRequest(req: Request | NextRequest): string | null {
  const headerApiKey = req.headers.get("x-api-key");
  if (headerApiKey && headerApiKey.trim().length > 0) {
    return headerApiKey.trim();
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token.startsWith("sf_live_")) {
      return token;
    }
  }

  return null;
}

export function getClientIp(req: Request | NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

interface CounterEntry {
  count: number;
  windowStart: number;
}
const tieredMemoryStore = new Map<string, CounterEntry>();

export function _resetTieredRateLimitStore() {
  tieredMemoryStore.clear();
}

function checkMemoryWindow(id: string, max: number, windowMs = 60_000): { isLimited: boolean; remaining: number } {
  const now = Date.now();
  const entry = tieredMemoryStore.get(id);
  if (!entry || now - entry.windowStart > windowMs) {
    tieredMemoryStore.set(id, { count: 1, windowStart: now });
    return { isLimited: false, remaining: max - 1 };
  }
  entry.count += 1;
  const isLimited = entry.count > max;
  const remaining = Math.max(0, max - entry.count);
  return { isLimited, remaining };
}

/**
 * Checks rate limits with API-key tiering and IP-based fallback:
 *
 * 1. If API key is present:
 *    - Validates key hash, checks revocation and expiration (401 if invalid)
 *    - Applies key's tier ceiling (e.g. Free: 60/min, Creator: 300/min, Partner: 1000/min)
 *    - Applies account aggregate limit to prevent quota multiplication across keys
 *    - Returns 429 if either key or account limit is exceeded
 * 2. If no API key is present:
 *    - Backward-compatible fallback to IP-based rate limiting (default 30/min or routeDefaultLimit)
 */
export async function checkTieredRateLimit(
  req: Request | NextRequest,
  options?: {
    routeDefaultLimit?: number;
    windowMs?: number;
  }
): Promise<TieredRateLimitResult> {
  const rawKey = extractApiKeyFromRequest(req);

  // ── 1. Key-Based Tiered Rate Limiting ─────────────────────────────────────────
  if (rawKey) {
    const keyValidation = await validateApiKey(rawKey);
    if (!keyValidation.valid) {
      return {
        allowed: false,
        tier: "anonymous",
        limit: 0,
        remaining: 0,
        headers: { "X-RateLimit-Tier": "anonymous" },
        errorResponse: NextResponse.json(
          { error: "Invalid or revoked API key" },
          { status: 401 }
        ),
      };
    }

    const { keyId, userId, tier, limits } = keyValidation;

    // Check per-key limiter
    const keyCounter = checkMemoryWindow(`key:${keyId}`, limits.keyLimitPerMin);
    // Check per-account aggregate limiter (prevents quota-multiplication by creating multiple keys)
    const accountCounter = checkMemoryWindow(`account:${userId}`, limits.accountLimitPerMin);

    const headers: Record<string, string> = {
      "X-RateLimit-Tier": tier,
      "X-RateLimit-Limit": String(limits.keyLimitPerMin),
      "X-RateLimit-Remaining": String(keyCounter.remaining),
      "X-RateLimit-Account-Limit": String(limits.accountLimitPerMin),
      "X-RateLimit-Account-Remaining": String(accountCounter.remaining),
    };

    if (keyCounter.isLimited) {
      return {
        allowed: false,
        tier,
        limit: limits.keyLimitPerMin,
        remaining: 0,
        keyId,
        userId,
        headers,
        errorResponse: NextResponse.json(
          { error: `Rate limit exceeded for tier: ${tier}` },
          { status: 429, headers: { ...headers, "Retry-After": "60" } }
        ),
      };
    }

    if (accountCounter.isLimited) {
      return {
        allowed: false,
        tier,
        limit: limits.accountLimitPerMin,
        remaining: 0,
        keyId,
        userId,
        headers,
        errorResponse: NextResponse.json(
          { error: "Aggregate account rate limit exceeded across API keys" },
          { status: 429, headers: { ...headers, "Retry-After": "60" } }
        ),
      };
    }

    return {
      allowed: true,
      tier,
      limit: limits.keyLimitPerMin,
      remaining: keyCounter.remaining,
      keyId,
      userId,
      headers,
    };
  }

  // ── 2. Anonymous / IP-Based Fallback ──────────────────────────────────────────
  const ip = getClientIp(req);
  const anonymousLimit = options?.routeDefaultLimit ?? ANONYMOUS_IP_LIMIT_PER_MIN;
  const ipCounter = checkMemoryWindow(`ip:${ip}`, anonymousLimit);

  const headers: Record<string, string> = {
    "X-RateLimit-Tier": "anonymous",
    "X-RateLimit-Limit": String(anonymousLimit),
    "X-RateLimit-Remaining": String(ipCounter.remaining),
  };

  if (ipCounter.isLimited) {
    return {
      allowed: false,
      tier: "anonymous",
      limit: anonymousLimit,
      remaining: 0,
      headers,
      errorResponse: NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { ...headers, "Retry-After": "60" } }
      ),
    };
  }

  return {
    allowed: true,
    tier: "anonymous",
    limit: anonymousLimit,
    remaining: ipCounter.remaining,
    headers,
  };
}
