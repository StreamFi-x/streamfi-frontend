import { Redis } from "@upstash/redis";

let client: Redis | null | undefined;

/**
 * Shared Upstash client for the instance, or null when
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are unset (local dev,
 * tests). Upstash speaks HTTP, so there is no connection to pool: one client
 * per serverless instance is all we need.
 */
export function getUpstashRedis(): Redis | null {
  if (client === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    client = url && token ? new Redis({ url, token }) : null;
  }
  return client;
}

export function resetUpstashRedisForTests(): void {
  client = undefined;
}
