import { ApiKeyTier, TierConfig } from "./types";

/**
 * Maximum active API keys allowed per verified account.
 * Prevents key spam and abuse by binding key issuance to accounts.
 */
export const MAX_ACTIVE_KEYS_PER_USER = 5;

/** Default rate limit window (60 seconds = 1 minute) */
export const DEFAULT_WINDOW_MS = 60_000;

/**
 * Rate limit ceilings by tier.
 * Both per-key limit and per-account aggregate limits are defined.
 * If a consumer generates multiple keys under the same account, the account aggregate
 * limit prevents multiplying their effective quota.
 */
export const TIER_LIMITS: Record<ApiKeyTier | "anonymous", TierConfig> = {
  anonymous: {
    name: "anonymous",
    requestsPerWindow: 30, // 30 req/min per IP
    accountAggregateLimit: 30,
    windowMs: DEFAULT_WINDOW_MS,
  },
  free: {
    name: "free",
    requestsPerWindow: 60, // 60 req/min per key
    accountAggregateLimit: 100, // 100 req/min aggregate per account
    windowMs: DEFAULT_WINDOW_MS,
  },
  creator: {
    name: "creator",
    requestsPerWindow: 300, // 300 req/min per key
    accountAggregateLimit: 500, // 500 req/min aggregate per account
    windowMs: DEFAULT_WINDOW_MS,
  },
  pro: {
    name: "pro",
    requestsPerWindow: 1000, // 1,000 req/min per key
    accountAggregateLimit: 1500, // 1,500 req/min aggregate per account
    windowMs: DEFAULT_WINDOW_MS,
  },
  enterprise: {
    name: "enterprise",
    requestsPerWindow: 3000, // 3,000 req/min per key
    accountAggregateLimit: 5000, // 5,000 req/min aggregate per account
    windowMs: DEFAULT_WINDOW_MS,
  },
};
