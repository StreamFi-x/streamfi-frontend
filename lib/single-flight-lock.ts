import { randomUUID } from "crypto";
import { getUpstashRedis } from "@/lib/upstash-redis";

/**
 * Mutual exclusion for expensive operations that must not overlap for the same
 * subject (e.g. one tip refresh per creator at a time).
 *
 * Redis: SET NX PX with a random token; release deletes only if the token
 * still matches, so a holder whose TTL lapsed cannot free a newer holder's
 * lock. The TTL bounds how long a crashed or frozen function can block others.
 *
 * Without Redis, or if Redis errors, falls back to a per-instance lock (same
 * degradation policy as lib/rate-limit.ts).
 */

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

export interface LockHandle {
  release(): Promise<void>;
}

export interface LockOptions {
  ttlMs: number;
  now?: () => number;
}

const memoryLocks = new Map<string, { token: string; expiresAt: number }>();

function acquireMemory(
  key: string,
  ttlMs: number,
  now: () => number
): LockHandle | null {
  const held = memoryLocks.get(key);
  if (held && held.expiresAt > now()) {
    return null;
  }
  const token = randomUUID();
  memoryLocks.set(key, { token, expiresAt: now() + ttlMs });
  return {
    async release() {
      if (memoryLocks.get(key)?.token === token) {
        memoryLocks.delete(key);
      }
    },
  };
}

export async function acquireLock(
  name: string,
  { ttlMs, now = Date.now }: LockOptions
): Promise<LockHandle | null> {
  const key = `lock:${name}`;
  const redis = getUpstashRedis();
  if (!redis) {
    return acquireMemory(key, ttlMs, now);
  }

  const token = randomUUID();
  try {
    const ok = await redis.set(key, token, { nx: true, px: ttlMs });
    if (ok === null) {
      return null;
    }
  } catch (err) {
    console.error(`[lock] Redis acquire failed for ${key}:`, err);
    return acquireMemory(key, ttlMs, now);
  }

  return {
    async release() {
      try {
        await redis.eval(RELEASE_SCRIPT, [key], [token]);
      } catch (err) {
        // The TTL frees it; log so a stuck lock is explainable.
        console.error(`[lock] Redis release failed for ${key}:`, err);
      }
    },
  };
}

export function resetMemoryLocksForTests(): void {
  memoryLocks.clear();
}
