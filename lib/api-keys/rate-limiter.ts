import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, touchApiKey } from "./service";
import { TIER_LIMITS } from "./tier-config";
import { RateLimitCheckResult } from "./types";

interface WindowEntry {
  count: number;
  windowStart: number;
}

// In-memory sliding window store for rate limiting counters
const rateLimitStore = new Map<string, WindowEntry>();

function checkWindow(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitStore.set(identifier, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      retryAfterSeconds: 0,
    };
  }

  if (entry.count >= maxRequests) {
    const elapsed = now - entry.windowStart;
    const retryAfter = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: retryAfter,
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Extract API key from request headers.
 * Supports:
 * - 'x-api-key: sf_live_...'
 * - 'authorization: Bearer sf_live_...'
 */
export function extractApiKey(req: Request | NextRequest): string | null {
  const customHeader = req.headers.get("x-api-key");
  if (customHeader) {
    return customHeader.trim();
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token.startsWith("sf_live_")) {
      return token;
    }
  }

  return null;
}

/**
 * Extract client IP address for fallback rate limiting.
 */
export function extractClientIp(req: Request | NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

/**
 * Core rate limit checker that enforces:
 * 1. Immediate invalidation on revoked / invalid keys (401)
 * 2. Key-level rate limit according to assigned tier (429)
 * 3. Per-account aggregate rate limit to prevent quota multiplication via multiple keys (429)
 * 4. Backward compatible fallback to IP-based rate limiting when no API key is provided
 */
export async function checkRateLimit(
  req: Request | NextRequest,
  options?: {
    customIpLimit?: number;
    routeId?: string;
  }
): Promise<RateLimitCheckResult> {
  const rawKey = extractApiKey(req);
  const routePrefix = options?.routeId ? `${options.routeId}:` : "";

  // ── 1. Key-authenticated consumer flow ───────────────────────────────────
  if (rawKey) {
    const keyRecord = await validateApiKey(rawKey);

    // If key not found or revoked -> reject immediately
    if (!keyRecord) {
      return {
        allowed: false,
        status: 401,
        error: "Invalid or revoked API key",
        tier: "anonymous",
      };
    }

    const tier = keyRecord.tier;
    const tierConfig = TIER_LIMITS[tier] || TIER_LIMITS.free;

    // A. Check per-key rate limit
    const keyCheck = checkWindow(
      `${routePrefix}sf:key:${keyRecord.id}`,
      tierConfig.requestsPerWindow,
      tierConfig.windowMs
    );

    if (!keyCheck.allowed) {
      return {
        allowed: false,
        status: 429,
        error: `Rate limit exceeded for API key (${tierConfig.requestsPerWindow} requests/minute for ${tier} tier).`,
        tier,
        keyId: keyRecord.id,
        userId: keyRecord.userId,
        retryAfterSeconds: keyCheck.retryAfterSeconds,
      };
    }

    // B. Check per-account aggregate rate limit across all keys of this account
    const accountCheck = checkWindow(
      `${routePrefix}sf:account:${keyRecord.userId}`,
      tierConfig.accountAggregateLimit,
      tierConfig.windowMs
    );

    if (!accountCheck.allowed) {
      return {
        allowed: false,
        status: 429,
        error: `Account aggregate rate limit exceeded across API keys (${tierConfig.accountAggregateLimit} requests/minute for ${tier} tier).`,
        tier,
        keyId: keyRecord.id,
        userId: keyRecord.userId,
        retryAfterSeconds: accountCheck.retryAfterSeconds,
      };
    }

    // Touch last used timestamp asynchronously
    touchApiKey(keyRecord.id).catch(() => {});

    return {
      allowed: true,
      tier,
      keyId: keyRecord.id,
      userId: keyRecord.userId,
    };
  }

  // ── 2. Unauthenticated / unkeyed fallback flow (IP-based) ────────────────
  const ip = extractClientIp(req);
  const anonConfig = TIER_LIMITS.anonymous;
  const ipLimit = options?.customIpLimit ?? anonConfig.requestsPerWindow;

  const ipCheck = checkWindow(
    `${routePrefix}sf:ip:${ip}`,
    ipLimit,
    anonConfig.windowMs
  );

  if (!ipCheck.allowed) {
    return {
      allowed: false,
      status: 429,
      error: `Rate limit exceeded for unauthenticated IP (${ipLimit} requests/minute). Pass an API key in 'x-api-key' for higher rate limits.`,
      tier: "anonymous",
      retryAfterSeconds: ipCheck.retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    tier: "anonymous",
  };
}

/**
 * Helper to handle rate limiting and return a NextResponse on failure or null on success.
 */
export async function enforceRateLimit(
  req: Request | NextRequest,
  options?: { customIpLimit?: number; routeId?: string }
): Promise<NextResponse | null> {
  const result = await checkRateLimit(req, options);

  if (!result.allowed) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (result.retryAfterSeconds) {
      headers["Retry-After"] = String(result.retryAfterSeconds);
    }
    return NextResponse.json(
      { error: result.error, tier: result.tier },
      { status: result.status ?? 429, headers }
    );
  }

  return null;
}

/** For testing: clear rate limit window counters */
export function _resetRateLimitStore(): void {
  rateLimitStore.clear();
}
