/**
 * @jest-environment node
 */
import type { Redis } from "@upstash/redis";
import { createCache, createRedisBackend } from "../store";

/** Minimal in-memory stand-in for the Upstash commands the backend uses. */
function fakeRedis() {
  const data = new Map<string, unknown>();
  const expiries = new Map<string, number>();
  const redis = {
    get: jest.fn(async (k: string) => data.get(k) ?? null),
    set: jest.fn(async (k: string, v: unknown, opts: { ex: number }) => {
      data.set(k, v);
      expiries.set(k, opts.ex);
      return "OK";
    }),
    mget: jest.fn(async (...keys: string[]) =>
      keys.map(k => data.get(k) ?? null)
    ),
    pipeline: jest.fn(() => {
      const ops: (() => void)[] = [];
      const p = {
        incr: (k: string) => {
          ops.push(() => data.set(k, Number(data.get(k) ?? 0) + 1));
          return p;
        },
        expire: (k: string, s: number) => {
          ops.push(() => expiries.set(k, s));
          return p;
        },
        exec: async () => ops.forEach(op => op()),
      };
      return p;
    }),
  };
  return { redis: redis as unknown as Redis & typeof redis, data, expiries };
}

describe("Redis cache backend", () => {
  it("stores entries with EX and keys them by tag versions", async () => {
    const { redis, expiries } = fakeRedis();
    const cache = createCache(createRedisBackend(redis));

    await cache.getOrLoad(
      { key: "profile:a", tags: ["user:name:a"], ttlSeconds: 60 },
      async () => ({
        id: 1,
      })
    );

    const [key, , opts] = redis.set.mock.calls[0];
    expect(key).toBe("cache:v1:profile:a#user:name:a=0");
    expect(opts).toEqual({ ex: 60 });
    expect(expiries.get(key)).toBe(60);
  });

  it("invalidation INCRs the tag version and keeps it alive longer than any entry", async () => {
    const { redis, data, expiries } = fakeRedis();
    const cache = createCache(createRedisBackend(redis));
    const load = jest
      .fn()
      .mockResolvedValueOnce("v1")
      .mockResolvedValueOnce("v2");
    const entry = { key: "profile:a", tags: ["user:name:a"], ttlSeconds: 60 };

    await cache.getOrLoad(entry, load);
    await cache.invalidate(["user:name:a", "user:name:a"]);

    expect(data.get("cache:tagver:user:name:a")).toBe(1);
    expect(expiries.get("cache:tagver:user:name:a")).toBeGreaterThan(
      24 * 60 * 60
    );
    await expect(cache.getOrLoad(entry, load)).resolves.toBe("v2");
    expect(redis.get).toHaveBeenLastCalledWith(
      "cache:v1:profile:a#user:name:a=1"
    );
  });

  it("skips MGET for untagged entries", async () => {
    const { redis } = fakeRedis();
    const cache = createCache(createRedisBackend(redis));
    await cache.getOrLoad(
      { key: "admin:analytics", ttlSeconds: 30 },
      async () => 1
    );
    expect(redis.mget).not.toHaveBeenCalled();
  });
});
