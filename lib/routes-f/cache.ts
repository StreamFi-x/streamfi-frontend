import { Redis } from "@upstash/redis";

type CacheRecord<T> = {
  expiresAt: number;
  value: T;
};

const memoryCache = new Map<string, CacheRecord<unknown>>();

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({ url, token });
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const value = await redis.get<T>(key);
      return value ?? null;
    } catch (error) {
      console.warn(`[routes-f cache] Redis GET failed for ${key}:`, error);
    }
  }

  const fallback = memoryCache.get(key);
  if (!fallback || fallback.expiresAt <= Date.now()) {
    if (fallback) {
      memoryCache.delete(key);
    }
    return null;
  }

  return fallback.value as T;
}

export async function setCachedJson<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
      return;
    } catch (error) {
      console.warn(`[routes-f cache] Redis SET failed for ${key}:`, error);
    }
  }

  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}
