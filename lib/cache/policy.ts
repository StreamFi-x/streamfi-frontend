/**
 * The single place that decides what StreamFi caches, where, and for how long.
 * docs/caching-policy.md explains each category; change both together.
 *
 * Two layers exist:
 *  - HTTP/CDN (`cacheControl`): Vercel's edge honours `s-maxage`. Keep
 *    `s-maxage` short for data that changes on write. A policy with
 *    `cdnCacheControl` is the exception: its responses carry that header
 *    (`Vercel-CDN-Cache-Control`, which Vercel's CDN obeys ahead of
 *    Cache-Control) plus `Vercel-Cache-Tag`, so the CDN can hold them for a
 *    long time and `invalidateTags` purges them by tag on write
 *    (`revalidateTag(tag, { expire: 0 })` also purges tagged CDN entries).
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
  /**
   * Long-lived Vercel CDN directive, only for data whose every write path
   * purges its tag. Requires tags in `cacheHeaders(policy, { tags })`.
   */
  cdnCacheControl?: string;
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
  // Low-churn, read on nearly every page (#1417). Vercel's CDN keeps it for a
  // day and every write purges the tag, so the edge is exact, not TTL-bound.
  // Browsers must revalidate (max-age=0): a purge cannot reach them. The short
  // s-maxage only applies to caches that ignore Vercel-CDN-Cache-Control.
  referenceData: {
    cacheControl: "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    cdnCacheControl: "public, max-age=86400, stale-while-revalidate=604800",
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
  // Revalidate on every use: these reads are served by the read replica with
  // read-your-own-writes routing (lib/db/replica.ts), which a browser copy
  // held for a minute would bypass after the creator's own write.
  privateAnalytics: {
    cacheControl: "private, no-cache",
    appTtlSeconds: 0,
    shared: false,
  },
  privateNoStore: {
    cacheControl: "private, no-store",
    appTtlSeconds: 0,
    shared: false,
  },
};

export function cacheHeaders(
  policy: CachePolicyName,
  options: { tags?: string[] } = {}
): Record<string, string> {
  const { cacheControl, cdnCacheControl, shared } = CACHE_POLICIES[policy];
  const headers: Record<string, string> = { "Cache-Control": cacheControl };
  if (cdnCacheControl) {
    if (!options.tags?.length) {
      // Without a tag nothing could purge the long CDN entry.
      throw new Error(`cacheHeaders("${policy}") needs tags`);
    }
    headers["Vercel-CDN-Cache-Control"] = cdnCacheControl;
  }
  if (shared && options.tags?.length) {
    headers["Vercel-Cache-Tag"] = options.tags.join(",");
  }
  return headers;
}
