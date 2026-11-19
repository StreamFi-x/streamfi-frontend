/**
 * @jest-environment node
 */
const redis = { set: jest.fn(), eval: jest.fn() };
let redisEnabled = false;
jest.mock("@/lib/upstash-redis", () => ({
  getUpstashRedis: () => (redisEnabled ? redis : null),
}));

import {
  acquireLock,
  resetMemoryLocksForTests,
} from "@/lib/single-flight-lock";

describe("single-flight lock", () => {
  beforeEach(() => {
    resetMemoryLocksForTests();
    redis.set.mockReset();
    redis.eval.mockReset();
    redisEnabled = false;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("admits one holder per name until released", async () => {
    const first = await acquireLock("refresh:u1", { ttlMs: 60_000 });
    expect(first).not.toBeNull();
    expect(await acquireLock("refresh:u1", { ttlMs: 60_000 })).toBeNull();
    expect(await acquireLock("refresh:u2", { ttlMs: 60_000 })).not.toBeNull();

    await first!.release();
    expect(await acquireLock("refresh:u1", { ttlMs: 60_000 })).not.toBeNull();
  });

  it("lets exactly one of many concurrent callers win", async () => {
    const handles = await Promise.all(
      Array.from({ length: 20 }, () =>
        acquireLock("refresh:u1", { ttlMs: 60_000 })
      )
    );
    expect(handles.filter(Boolean)).toHaveLength(1);
  });

  it("expires so a crashed holder cannot block forever", async () => {
    let t = 0;
    await acquireLock("refresh:u1", { ttlMs: 1_000, now: () => t });
    t = 999;
    expect(
      await acquireLock("refresh:u1", { ttlMs: 1_000, now: () => t })
    ).toBeNull();
    t = 1_000;
    expect(
      await acquireLock("refresh:u1", { ttlMs: 1_000, now: () => t })
    ).not.toBeNull();
  });

  it("a lapsed holder releasing does not free the next holder", async () => {
    let t = 0;
    const stale = await acquireLock("refresh:u1", {
      ttlMs: 1_000,
      now: () => t,
    });
    t = 2_000;
    await acquireLock("refresh:u1", { ttlMs: 1_000, now: () => t });
    await stale!.release();
    expect(
      await acquireLock("refresh:u1", { ttlMs: 1_000, now: () => t })
    ).toBeNull();
  });

  describe("with Redis", () => {
    beforeEach(() => {
      redisEnabled = true;
    });

    it("uses SET NX PX and releases with a token check", async () => {
      redis.set.mockResolvedValue("OK");
      const handle = await acquireLock("refresh:u1", { ttlMs: 300_000 });
      const [key, token, opts] = redis.set.mock.calls[0];
      expect(key).toBe("lock:refresh:u1");
      expect(opts).toEqual({ nx: true, px: 300_000 });

      await handle!.release();
      expect(redis.eval).toHaveBeenCalledWith(
        expect.stringContaining("del"),
        [key],
        [token]
      );
    });

    it("returns null when another instance holds it", async () => {
      redis.set.mockResolvedValue(null);
      expect(await acquireLock("refresh:u1", { ttlMs: 1_000 })).toBeNull();
    });

    it("falls back to a per-instance lock when Redis errors", async () => {
      redis.set.mockRejectedValue(new Error("down"));
      expect(await acquireLock("refresh:u1", { ttlMs: 1_000 })).not.toBeNull();
      expect(await acquireLock("refresh:u1", { ttlMs: 1_000 })).toBeNull();
    });
  });
});
