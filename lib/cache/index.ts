import { revalidateTag } from "next/cache";
import { getUpstashRedis } from "@/lib/upstash-redis";
import {
  createCache,
  createMemoryBackend,
  createRedisBackend,
  type Cache,
  type CacheEntryOptions,
} from "./store";

export { CACHE_POLICIES, cacheHeaders, type CachePolicyName } from "./policy";
export { cacheKey, cacheTags } from "./tags";

/**
 * Without Redis each serverless instance has its own memory, so an
 * invalidation only reaches the instance that performed the write. Clamp TTLs
 * so cross-instance staleness stays short in that (dev-only) configuration.
 */
const MEMORY_ONLY_MAX_TTL_SECONDS = 30;

let appCache: Cache | undefined;

function getAppCache(): Cache {
  if (!appCache) {
    const redis = getUpstashRedis();
    appCache = redis
      ? createCache(createRedisBackend(redis))
      : createCache(createMemoryBackend(), {
          maxTtlSeconds: MEMORY_ONLY_MAX_TTL_SECONDS,
        });
  }
  return appCache;
}

export function cached<T>(
  options: CacheEntryOptions,
  load: () => Promise<T>
): Promise<T> {
  return getAppCache().getOrLoad(options, load);
}

/**
 * Invalidates application-cache entries and Next.js data-cache entries
 * (`unstable_cache` with the same tags) for every tag given.
 */
export async function invalidateTags(tags: string[]): Promise<void> {
  await getAppCache().invalidate(tags);
  for (const tag of new Set(tags)) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch {
      // Outside a Next.js request scope (scripts, tests) there is no data cache.
    }
  }
}

export function resetAppCacheForTests(): void {
  appCache = undefined;
}
