import type { Redis } from "@upstash/redis";

/**
 * Versioned-tag cache.
 *
 * Every tag has a version counter. An entry's storage key embeds the versions
 * of its tags as read *before* the loader runs, and invalidating a tag is an
 * atomic INCR. After an invalidation, readers compute a new storage key and
 * miss; a reader that loaded stale data before the write stores it under the
 * old key, which nobody reads again. That closes the classic
 * "read-old / invalidate / write-old-back" race without locks, and makes
 * invalidation O(tags) instead of O(keys).
 *
 * Cache failures never fail a request: a backend error is treated as a miss
 * and the loader's result is returned uncached.
 */

/** Longest TTL an entry may have. Version counters must outlive entries. */
export const MAX_ENTRY_TTL_SECONDS = 24 * 60 * 60;
const VERSION_TTL_SECONDS = 7 * MAX_ENTRY_TTL_SECONDS;
const KEY_PREFIX = "cache:v1:";
const VERSION_PREFIX = "cache:tagver:";

export interface CacheBackend {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  getVersions(tags: string[]): Promise<number[]>;
  bumpVersions(tags: string[]): Promise<void>;
}

export interface CacheEntryOptions {
  key: string;
  tags?: string[];
  ttlSeconds: number;
}

export function createRedisBackend(redis: Redis): CacheBackend {
  return {
    get: key => redis.get(key),
    async set(key, value, ttlSeconds) {
      await redis.set(key, value, { ex: ttlSeconds });
    },
    async getVersions(tags) {
      if (tags.length === 0) {
        return [];
      }
      const values = await redis.mget<(number | string | null)[]>(
        ...tags.map(tag => VERSION_PREFIX + tag)
      );
      return values.map(v => Number(v ?? 0));
    },
    async bumpVersions(tags) {
      if (tags.length === 0) {
        return;
      }
      const pipeline = redis.pipeline();
      for (const tag of tags) {
        pipeline.incr(VERSION_PREFIX + tag);
        pipeline.expire(VERSION_PREFIX + tag, VERSION_TTL_SECONDS);
      }
      await pipeline.exec();
    },
  };
}

export function createMemoryBackend(
  now: () => number = () => Date.now()
): CacheBackend {
  const entries = new Map<string, { value: unknown; expiresAt: number }>();
  const versions = new Map<string, number>();

  return {
    async get(key) {
      const entry = entries.get(key);
      if (!entry) {
        return null;
      }
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttlSeconds) {
      entries.set(key, { value, expiresAt: now() + ttlSeconds * 1000 });
    },
    async getVersions(tags) {
      return tags.map(tag => versions.get(tag) ?? 0);
    },
    async bumpVersions(tags) {
      for (const tag of tags) {
        versions.set(tag, (versions.get(tag) ?? 0) + 1);
      }
    },
  };
}

function storageKey(key: string, tags: string[], versions: number[]) {
  const suffix = tags.map((tag, i) => `${tag}=${versions[i]}`).join("|");
  return `${KEY_PREFIX}${key}#${suffix}`;
}

export interface Cache {
  getOrLoad<T>(options: CacheEntryOptions, load: () => Promise<T>): Promise<T>;
  invalidate(tags: string[]): Promise<void>;
}

export function createCache(
  backend: CacheBackend,
  { maxTtlSeconds = MAX_ENTRY_TTL_SECONDS }: { maxTtlSeconds?: number } = {}
): Cache {
  const inflight = new Map<string, Promise<unknown>>();

  async function getOrLoad<T>(
    { key, tags = [], ttlSeconds }: CacheEntryOptions,
    load: () => Promise<T>
  ): Promise<T> {
    if (ttlSeconds <= 0 || ttlSeconds > MAX_ENTRY_TTL_SECONDS) {
      throw new Error(
        `[cache] ttlSeconds for "${key}" must be within 1..${MAX_ENTRY_TTL_SECONDS}`
      );
    }
    const ttl = Math.min(ttlSeconds, maxTtlSeconds);

    let fullKey: string;
    try {
      fullKey = storageKey(key, tags, await backend.getVersions(tags));
    } catch (err) {
      console.warn(`[cache] version lookup failed for "${key}":`, err);
      return load();
    }

    try {
      const hit = await backend.get(fullKey);
      if (hit !== null && hit !== undefined) {
        return hit as T;
      }
    } catch (err) {
      console.warn(`[cache] GET failed for "${key}":`, err);
    }

    // Concurrent misses in one instance share a single load.
    const pending = inflight.get(fullKey);
    if (pending) {
      return pending as Promise<T>;
    }

    const loading = (async () => {
      const value = await load();
      // Absent results are not cached: a 404 must not outlive the row's creation.
      if (value !== null && value !== undefined) {
        try {
          await backend.set(fullKey, value, ttl);
        } catch (err) {
          console.warn(`[cache] SET failed for "${key}":`, err);
        }
      }
      return value;
    })().finally(() => inflight.delete(fullKey));

    inflight.set(fullKey, loading);
    return loading;
  }

  async function invalidate(tags: string[]): Promise<void> {
    const unique = [...new Set(tags)];
    if (unique.length === 0) {
      return;
    }
    try {
      await backend.bumpVersions(unique);
    } catch (err) {
      // Entries stay readable until their TTL expires; policy TTLs bound this.
      console.error(
        `[cache] invalidation failed for ${unique.join(",")}:`,
        err
      );
    }
  }

  return { getOrLoad, invalidate };
}
