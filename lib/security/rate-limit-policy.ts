/**
 * Centralized Rate Limiting Policy Configuration (#1386)
 *
 * Defines rate limit policies for different route categories.
 * Supports dual IP+user-id keying for authenticated routes.
 */

import { createRateLimit, type RateLimitResult } from "@/lib/rate-limit";

export interface RateLimitPolicy {
  /** Maximum requests per window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Whether to also apply a per-user-id limit (in addition to IP) */
  enableUserLimit?: boolean;
  /** Separate limit for user-id if different from IP limit */
  userLimit?: number;
  /** Description of what this protects */
  description: string;
}

/**
 * Rate limit policies organized by route category
 */
export const RATE_LIMIT_POLICIES = {
  // Authentication routes - protect against credential stuffing
  auth: {
    session: { limit: 10, windowMs: 60_000, description: "Privy session exchanges" },
    walletSession: { limit: 20, windowMs: 60_000, description: "Wallet session creation" },
    magicLinkRequest: { limit: 5, windowMs: 15 * 60_000, description: "Magic link requests" },
    passwordReset: { limit: 5, windowMs: 15 * 60_000, description: "Password reset requests" },
  },

  // Mutating operations - protect against abuse
  tips: {
    send: { limit: 30, windowMs: 60_000, enableUserLimit: true, userLimit: 10, description: "Tip sending" },
    refresh: { limit: 10, windowMs: 60_000, enableUserLimit: true, userLimit: 5, description: "Tip total refresh" },
  },

  // Stream operations
  streams: {
    start: { limit: 10, windowMs: 60_000, enableUserLimit: true, userLimit: 3, description: "Stream start" },
    update: { limit: 30, windowMs: 60_000, enableUserLimit: true, userLimit: 10, description: "Stream updates" },
    chat: { limit: 60, windowMs: 60_000, enableUserLimit: true, userLimit: 20, description: "Chat messages" },
    viewers: { limit: 60, windowMs: 60_000, description: "Viewer join/leave events" },
  },

  // User operations
  users: {
    update: { limit: 20, windowMs: 60_000, enableUserLimit: true, userLimit: 5, description: "Profile updates" },
    follow: { limit: 30, windowMs: 60_000, enableUserLimit: true, userLimit: 10, description: "Follow/unfollow" },
    notifications: { limit: 20, windowMs: 60_000, enableUserLimit: true, userLimit: 5, description: "Notification actions" },
  },

  // Administrative operations
  admin: {
    analytics: { limit: 20, windowMs: 60_000, enableUserLimit: true, userLimit: 5, description: "Admin analytics" },
    moderation: { limit: 30, windowMs: 60_000, enableUserLimit: true, userLimit: 10, description: "Moderation actions" },
  },

  // Webhooks - IP-based rate limiting
  webhooks: {
    mux: { limit: 120, windowMs: 60_000, description: "Mux webhooks" },
    privy: { limit: 60, windowMs: 60_000, description: "Privy webhooks" },
    stellar: { limit: 60, windowMs: 60_000, description: "Stellar payment webhooks" },
  },
} as const;

/**
 * Get a rate limiter for a specific policy
 */
export function getPolicyLimiter(
  policy: RateLimitPolicy,
  namespace: string
) {
  return createRateLimit({
    namespace,
    limit: policy.limit,
    windowMs: policy.windowMs,
  });
}

/**
 * Check rate limits with dual IP+user-id keying
 */
export async function checkRateLimits(
  policy: RateLimitPolicy,
  namespace: string,
  ip: string,
  userId?: string
): Promise<{ allowed: boolean; result: RateLimitResult; userResult?: RateLimitResult }> {
  const limiter = getPolicyLimiter(policy, namespace);
  
  // Always check IP-based limit
  const ipResult = await limiter.check(ip);
  
  // If user-id is available and policy enables user limits, check that too
  if (userId && policy.enableUserLimit) {
    const userLimiter = createRateLimit({
      namespace: `${namespace}:user`,
      limit: policy.userLimit || policy.limit,
      windowMs: policy.windowMs,
    });
    const userResult = await userLimiter.check(userId);
    
    // Both limits must pass
    return {
      allowed: ipResult.success && userResult.success,
      result: ipResult,
      userResult,
    };
  }
  
  return {
    allowed: ipResult.success,
    result: ipResult,
  };
}

/**
 * Get client IP address from request headers
 */
export function getClientIp(req: {
  headers: { get(name: string): string | null };
}): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}