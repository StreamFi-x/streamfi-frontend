/**
 * The single place that decides what StreamFi caches, where, and for how long.
 * docs/caching-policy.md explains each category; change both together.
 *
 * Two layers exist:
 *  - HTTP/CDN (`cacheControl`): Vercel's edge honours `s-maxage`. It cannot be
 *    purged per key from application code, so anything cached here is only
 *    ever TTL-consistent. Keep `s-maxage` short for data that changes on write.
 *  - Application (`appTtlSeconds`): Upstash Redis via `lib/cache`. Entries are
 *    keyed by versioned tags, so write paths invalidate them immediately.
 */

export type CachePolicyName =
  | "chatWindow"
  | "typeahead"
  | "liveState"
  | "publicProfile"
  | "publicListing"
  | "referenceData"
  | "staticAsset"
  | "adminAggregate"
  | "privateAnalytics"
  | "privateNoStore";

export interface CachePolicy {
  /** Cache-Control header value for the HTTP/CDN layer. */
  cacheControl: string;
  /** Application cache TTL in seconds; 0 means no application cache. */
  appTtlSeconds: number;
  /** True when the response may be stored by shared caches. */
  shared: boolean;
}

export const CACHE_POLICIES: Record<CachePolicyName, CachePolicy> = {
  // Identical for every viewer of a stream, so the edge collapses N pollers
  // into ~1 origin request per second per region.
  chatWindow: {
    cacheControl: "public, s-maxage=1, stale-while-revalidate=1",
    appTtlSeconds: 1,
    shared: true,
  },
  typeahead: {
    cacheControl: "public, s-maxage=5",
    appTtlSeconds: 0,
    shared: true,
  },
  liveState: {
    cacheControl: "public, s-maxage=10, stale-while-revalidate=30",
    appTtlSeconds: 0,
    shared: true,
  },
  // Invalidated on write in the app layer; the edge adds at most ~15s.
  publicProfile: {
    cacheControl: "public, s-maxage=5, stale-while-revalidate=10",
    appTtlSeconds: 60,
    shared: true,
  },
  publicListing: {
    cacheControl: "public, s-maxage=30, stale-while-revalidate=60",
    appTtlSeconds: 0,
    shared: true,
  },
  referenceData: {
    cacheControl: "public, s-maxage=60, stale-while-revalidate=300",
    appTtlSeconds: 3600,
    shared: true,
  },
  staticAsset: {
    cacheControl: "public, s-maxage=86400, stale-while-revalidate=604800",
    appTtlSeconds: 0,
    shared: true,
  },
  // Shared across admins in Redis, never stored by the edge or the browser.
  adminAggregate: {
    cacheControl: "private, no-store",
    appTtlSeconds: 30,
    shared: false,
  },
  privateAnalytics: {
    cacheControl: "private, max-age=60",
    appTtlSeconds: 0,
    shared: false,
  },
  privateNoStore: {
    cacheControl: "private, no-store",
    appTtlSeconds: 0,
    shared: false,
  },
};

export function cacheHeaders(policy: CachePolicyName): {
  "Cache-Control": string;
} {
  return { "Cache-Control": CACHE_POLICIES[policy].cacheControl };
}
