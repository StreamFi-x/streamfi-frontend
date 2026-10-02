import { Redis } from "@upstash/redis";
import { logger } from "@/lib/tracing/logger";

/**
 * Minimal key/value primitives needed by the security layer (admin auth
 * throttling, alert de-duplication). Backed by the same Upstash Redis
 * instance as lib/rate-limit.ts so every serverless instance shares one view
 * of attacker state. Without Upstash credentials (local dev, tests) an
 * in-memory store is used — it is per-process, so it is NOT a substitute for
 * Redis in production.
 */
export interface SecurityKvStore {
  /** Atomically increments `key` and (re)sets its TTL. Returns the new value. */
  incrWithTtl(key: string, ttlMs: number): Promise<number>;
  /** Sets `key` only when absent. Returns true if this call created it. */
  setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean>;
  /** Sets `key` unconditionally with a TTL. */
  set(key: string, value: string, ttlMs: number): Promise<void>;
  get(key: string): Promise<string | null>;
  /** Remaining TTL in ms, or 0 if the key does not exist. */
  ttlMs(key: string): Promise<number>;
  del(...keys: string[]): Promise<void>;
}

class UpstashKvStore implements SecurityKvStore {
  constructor(private readonly redis: Redis) {}

  async incrWithTtl(key: string, ttlMs: number): Promise<number> {
    const [count] = await this.redis
      .multi()
      .incr(key)
      .pexpire(key, ttlMs)
      .exec<[number, number]>();
    return count;
  }

  async setIfAbsent(key: string, value: string, ttlMs: number) {
    const res = await this.redis.set(key, value, { nx: true, px: ttlMs });
    return res === "OK";
  }

  async set(key: string, value: string, ttlMs: number) {
    await this.redis.set(key, value, { px: ttlMs });
  }

  async get(key: string) {
    const value = await this.redis.get<string | number>(key);
    return value === null || value === undefined ? null : String(value);
  }

  async ttlMs(key: string) {
    const ttl = await this.redis.pttl(key);
    return ttl > 0 ? ttl : 0;
  }

  async del(...keys: string[]) {
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

export class MemoryKvStore implements SecurityKvStore {
  private readonly store = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  constructor(private readonly now: () => number = Date.now) {}

  private live(key: string) {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  async incrWithTtl(key: string, ttlMs: number) {
    const next = Number(this.live(key)?.value ?? 0) + 1;
    this.store.set(key, {
      value: String(next),
      expiresAt: this.now() + ttlMs,
    });
    return next;
  }

  async setIfAbsent(key: string, value: string, ttlMs: number) {
    if (this.live(key)) {
      return false;
    }
    this.store.set(key, { value, expiresAt: this.now() + ttlMs });
    return true;
  }

  async set(key: string, value: string, ttlMs: number) {
    this.store.set(key, { value, expiresAt: this.now() + ttlMs });
  }

  async get(key: string) {
    return this.live(key)?.value ?? null;
  }

  async ttlMs(key: string) {
    const entry = this.live(key);
    return entry ? entry.expiresAt - this.now() : 0;
  }

  async del(...keys: string[]) {
    for (const key of keys) {
      this.store.delete(key);
    }
  }
}

let _store: SecurityKvStore | null = null;

export function getSecurityKvStore(): SecurityKvStore {
  if (_store) {
    return _store;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    _store = new UpstashKvStore(new Redis({ url, token }));
  } else {
    if (process.env.NODE_ENV === "production") {
      logger.error(
        "security_kv_store_in_memory: UPSTASH_REDIS_REST_URL/TOKEN not set — admin auth throttling and alert de-duplication are per-instance only"
      );
    }
    _store = new MemoryKvStore();
  }
  return _store;
}

/** Test hook: swap the backing store. Pass null to reset to the default. */
export function setSecurityKvStoreForTesting(store: SecurityKvStore | null) {
  _store = store;
}
