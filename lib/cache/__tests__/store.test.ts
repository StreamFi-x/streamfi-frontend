/**
 * @jest-environment node
 */
import { createCache, createMemoryBackend, type CacheBackend } from "../store";

function setup() {
  let now = 1_000_000;
  const clock = {
    advance: (ms: number) => {
      now += ms;
    },
  };
  const backend = createMemoryBackend(() => now);
  const cache = createCache(backend);
  return { cache, backend, clock };
}

describe("versioned-tag cache", () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    error = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
  });

  it("misses, then hits without calling the loader again", async () => {
    const { cache } = setup();
    const load = jest.fn().mockResolvedValue({ v: 1 });
    const entry = { key: "k", tags: ["t"], ttlSeconds: 60 };

    await expect(cache.getOrLoad(entry, load)).resolves.toEqual({ v: 1 });
    await expect(cache.getOrLoad(entry, load)).resolves.toEqual({ v: 1 });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("expires entries after their TTL", async () => {
    const { cache, clock } = setup();
    const load = jest
      .fn()
      .mockResolvedValueOnce("old")
      .mockResolvedValueOnce("new");
    const entry = { key: "k", ttlSeconds: 60 };

    await cache.getOrLoad(entry, load);
    clock.advance(59_999);
    await expect(cache.getOrLoad(entry, load)).resolves.toBe("old");
    clock.advance(1);
    await expect(cache.getOrLoad(entry, load)).resolves.toBe("new");
  });

  it("a write that invalidates a tag makes the next read load fresh data", async () => {
    const { cache } = setup();
    let dbValue = "before-write";
    const load = jest.fn(async () => dbValue);
    const entry = {
      key: "profile:alice",
      tags: ["user:name:alice"],
      ttlSeconds: 300,
    };

    expect(await cache.getOrLoad(entry, load)).toBe("before-write");

    dbValue = "after-write";
    await cache.invalidate(["user:name:alice"]);

    expect(await cache.getOrLoad(entry, load)).toBe("after-write");
  });

  it("invalidates every entry sharing a tag, and only those", async () => {
    const { cache } = setup();
    const profile = jest.fn().mockResolvedValue("p");
    const stats = jest.fn().mockResolvedValue("s");
    const other = jest.fn().mockResolvedValue("o");

    const read = () =>
      Promise.all([
        cache.getOrLoad(
          { key: "profile", tags: ["user:name:a"], ttlSeconds: 60 },
          profile
        ),
        cache.getOrLoad(
          {
            key: "stats",
            tags: ["user:name:a", "user:wallet:GA"],
            ttlSeconds: 60,
          },
          stats
        ),
        cache.getOrLoad(
          { key: "profile-b", tags: ["user:name:b"], ttlSeconds: 60 },
          other
        ),
      ]);

    await read();
    await cache.invalidate(["user:name:a"]);
    await read();

    expect(profile).toHaveBeenCalledTimes(2);
    expect(stats).toHaveBeenCalledTimes(2);
    expect(other).toHaveBeenCalledTimes(1);
  });

  it("a load that started before an invalidation cannot repopulate stale data", async () => {
    const { cache } = setup();
    let release!: (v: string) => void;
    const slowStaleLoad = jest.fn(
      () => new Promise<string>(resolve => (release = resolve))
    );
    const entry = { key: "k", tags: ["t"], ttlSeconds: 300 };

    const inFlight = cache.getOrLoad(entry, slowStaleLoad);
    // Let getOrLoad read the tag version and start loading.
    while (slowStaleLoad.mock.calls.length === 0) {
      await new Promise(r => setImmediate(r));
    }
    await cache.invalidate(["t"]);
    release("stale");
    await expect(inFlight).resolves.toBe("stale");

    const fresh = jest.fn().mockResolvedValue("fresh");
    await expect(cache.getOrLoad(entry, fresh)).resolves.toBe("fresh");
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent misses for the same entry into one load", async () => {
    const { cache } = setup();
    const load = jest.fn(
      () => new Promise(resolve => setTimeout(() => resolve("v"), 5))
    );
    const entry = { key: "k", ttlSeconds: 1 };

    const results = await Promise.all(
      Array.from({ length: 25 }, () => cache.getOrLoad(entry, load))
    );

    expect(results.every(r => r === "v")).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache absent results", async () => {
    const { cache } = setup();
    const load = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("created");
    const entry = { key: "user:new", ttlSeconds: 300 };

    await expect(cache.getOrLoad(entry, load)).resolves.toBeNull();
    await expect(cache.getOrLoad(entry, load)).resolves.toBe("created");
  });

  it("does not cache loader failures", async () => {
    const { cache } = setup();
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce("ok");
    const entry = { key: "k", ttlSeconds: 60 };

    await expect(cache.getOrLoad(entry, load)).rejects.toThrow("db down");
    await expect(cache.getOrLoad(entry, load)).resolves.toBe("ok");
  });

  it("clamps TTLs to maxTtlSeconds", async () => {
    let now = 0;
    const cache = createCache(
      createMemoryBackend(() => now),
      { maxTtlSeconds: 30 }
    );
    const load = jest
      .fn()
      .mockResolvedValueOnce("a")
      .mockResolvedValueOnce("b");
    const entry = { key: "k", ttlSeconds: 3600 };

    await cache.getOrLoad(entry, load);
    now += 30_000;
    await expect(cache.getOrLoad(entry, load)).resolves.toBe("b");
  });

  it("rejects TTLs outside 1..24h", async () => {
    const { cache } = setup();
    await expect(
      cache.getOrLoad({ key: "k", ttlSeconds: 0 }, async () => 1)
    ).rejects.toThrow(/ttlSeconds/);
    await expect(
      cache.getOrLoad({ key: "k", ttlSeconds: 86_401 }, async () => 1)
    ).rejects.toThrow(/ttlSeconds/);
  });

  describe("backend failures never fail the request", () => {
    function failing(overrides: Partial<CacheBackend>): CacheBackend {
      return { ...createMemoryBackend(), ...overrides };
    }

    it("falls back to the loader when version lookup fails", async () => {
      const cache = createCache(
        failing({
          getVersions: jest.fn().mockRejectedValue(new Error("redis down")),
        })
      );
      await expect(
        cache.getOrLoad(
          { key: "k", tags: ["t"], ttlSeconds: 60 },
          async () => "db"
        )
      ).resolves.toBe("db");
    });

    it("treats a failed GET as a miss and a failed SET as best-effort", async () => {
      const cache = createCache(
        failing({
          get: jest.fn().mockRejectedValue(new Error("timeout")),
          set: jest.fn().mockRejectedValue(new Error("timeout")),
        })
      );
      await expect(
        cache.getOrLoad({ key: "k", ttlSeconds: 60 }, async () => "db")
      ).resolves.toBe("db");
    });

    it("logs, but does not throw, when invalidation fails", async () => {
      const cache = createCache(
        failing({
          bumpVersions: jest.fn().mockRejectedValue(new Error("redis down")),
        })
      );
      await expect(cache.invalidate(["t"])).resolves.toBeUndefined();
      expect(error).toHaveBeenCalled();
    });
  });
});
