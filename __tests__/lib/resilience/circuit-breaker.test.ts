/**
 * @jest-environment node
 */
import { Redis } from "@upstash/redis";
import {
  CircuitBreaker,
  CircuitOpenError,
  DownstreamTimeoutError,
  classifyFailure,
  type CircuitBreakerConfig,
} from "@/lib/resilience/circuit-breaker";
import {
  createMemoryBreakerStore,
  createRedisBreakerStore,
  type BreakerStore,
} from "@/lib/resilience/breaker-store";
import {
  HORIZON_BREAKER_DEFAULTS,
  MUX_BREAKER_DEFAULTS,
  breakerConfigFromEnv,
} from "@/lib/resilience/breakers";

jest.mock("@/lib/tracing/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function httpError(status: number): Error {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const REDIS_URL = process.env.TEST_UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.TEST_UPSTASH_REDIS_REST_TOKEN;

interface StoreFactory {
  label: string;
  make: () => BreakerStore;
}

const stores: StoreFactory[] = [
  { label: "memory store", make: () => createMemoryBreakerStore() },
];
if (REDIS_URL && REDIS_TOKEN) {
  const failOnFallback: BreakerStore = {
    acquire: () => Promise.reject(new Error("fell back to memory")),
    record: () => Promise.reject(new Error("fell back to memory")),
    peek: () => Promise.reject(new Error("fell back to memory")),
  };
  stores.push({
    label: "Redis store (Lua)",
    make: () =>
      createRedisBreakerStore(
        new Redis({ url: REDIS_URL, token: REDIS_TOKEN }),
        failOnFallback
      ),
  });
}

describe.each(stores)("CircuitBreaker with $label", ({ make }) => {
  let now: number;
  let store: BreakerStore;
  let seq = 0;

  function breaker(
    overrides: Partial<CircuitBreakerConfig> = {}
  ): CircuitBreaker {
    return new CircuitBreaker(
      {
        name: overrides.name ?? `test-${process.pid}-${seq}`,
        failureThreshold: 3,
        failureRate: 0.5,
        windowMs: 10_000,
        cooldownMs: 5_000,
        timeoutMs: 1_000,
        ...overrides,
      },
      { store, now: () => now }
    );
  }

  async function fail(b: CircuitBreaker, error: unknown = httpError(503)) {
    await expect(b.execute(() => Promise.reject(error))).rejects.toBe(error);
  }

  async function trip(b: CircuitBreaker) {
    for (let i = 0; i < b.config.failureThreshold; i++) {
      await fail(b);
    }
    expect(await b.state()).toBe("open");
  }

  beforeEach(() => {
    now = 1_000_000_000_000 + seq * 1_000_000;
    seq++;
    store = make();
  });

  describe("closed", () => {
    it("passes calls through and returns their result", async () => {
      const b = breaker();
      const downstream = jest.fn().mockResolvedValue("ok");
      await expect(b.execute(downstream)).resolves.toBe("ok");
      expect(downstream).toHaveBeenCalledTimes(1);
      expect(await b.state()).toBe("closed");
    });

    it("does not count 4xx answers as dependency failures", async () => {
      const b = breaker();
      for (let i = 0; i < 10; i++) {
        await fail(b, httpError(404));
      }
      expect(await b.state()).toBe("closed");
    });

    it("stays closed while the failure rate is below the threshold", async () => {
      const b = breaker({ failureThreshold: 3, failureRate: 0.5 });
      for (let i = 0; i < 7; i++) {
        await b.execute(() => Promise.resolve(i));
      }
      for (let i = 0; i < 3; i++) {
        await fail(b);
      }
      // 3 failures of 10 calls = 30% < 50%.
      expect(await b.state()).toBe("closed");
    });

    it("forgets failures that have left the window", async () => {
      const b = breaker({ failureThreshold: 3, windowMs: 10_000 });
      await fail(b);
      await fail(b);
      now += 10_001;
      await fail(b);
      expect(await b.state()).toBe("closed");
    });
  });

  describe("failure threshold", () => {
    it("opens after the threshold of qualifying failures", async () => {
      const b = breaker();
      await fail(b);
      await fail(b);
      expect(await b.state()).toBe("closed");
      await fail(b, new Error("socket hang up"));
      expect(await b.state()).toBe("open");
    });

    it("counts 429 and network errors as failures", async () => {
      const b = breaker();
      await fail(b, httpError(429));
      await fail(b, new Error("ECONNRESET"));
      await fail(b, httpError(500));
      expect(await b.state()).toBe("open");
    });
  });

  describe("open", () => {
    it("fails fast without calling the dependency", async () => {
      const b = breaker();
      await trip(b);
      const downstream = jest.fn().mockResolvedValue("ok");
      const error = await b.execute(downstream).catch(e => e);
      expect(error).toBeInstanceOf(CircuitOpenError);
      expect((error as CircuitOpenError).retryAfterMs).toBe(5_000);
      expect(downstream).not.toHaveBeenCalled();
    });

    it("keeps failing fast until the cooldown has elapsed", async () => {
      const b = breaker();
      await trip(b);
      now += 4_999;
      await expect(b.execute(() => Promise.resolve(1))).rejects.toBeInstanceOf(
        CircuitOpenError
      );
    });
  });

  describe("half-open", () => {
    it("lets one probe through after the cooldown and closes when it succeeds", async () => {
      const b = breaker();
      await trip(b);
      now += 5_000;
      const downstream = jest.fn().mockResolvedValue("recovered");
      await expect(b.execute(downstream)).resolves.toBe("recovered");
      expect(downstream).toHaveBeenCalledTimes(1);
      expect(await b.state()).toBe("closed");
      await expect(b.execute(() => Promise.resolve(2))).resolves.toBe(2);
    });

    it("reopens with a fresh cooldown when the probe fails", async () => {
      const b = breaker();
      await trip(b);
      now += 5_000;
      await fail(b);
      expect(await b.state()).toBe("open");
      now += 4_999;
      await expect(b.execute(() => Promise.resolve(1))).rejects.toBeInstanceOf(
        CircuitOpenError
      );
      now += 1;
      await expect(b.execute(() => Promise.resolve(1))).resolves.toBe(1);
    });

    it("rejects everyone else while the probe is in flight", async () => {
      const b = breaker();
      await trip(b);
      now += 5_000;
      const probe = deferred<string>();
      const probeCall = b.execute(() => probe.promise);
      // Let the probe acquire its lease before the others try.
      await new Promise(resolve => setTimeout(resolve, 20));
      const others = await Promise.allSettled(
        Array.from({ length: 10 }, () => b.execute(() => Promise.resolve("x")))
      );
      expect(others.every(r => r.status === "rejected")).toBe(true);
      probe.resolve("done");
      await expect(probeCall).resolves.toBe("done");
      expect(await b.state()).toBe("closed");
    });

    it("grants the probe to exactly one of many concurrent callers", async () => {
      const b = breaker();
      await trip(b);
      now += 5_000;
      const hold = deferred<void>();
      const downstream = jest.fn(() => hold.promise.then(() => "ok"));
      const settled = Promise.allSettled(
        Array.from({ length: 20 }, () => b.execute(downstream))
      );
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(downstream).toHaveBeenCalledTimes(1);
      hold.resolve();
      const results = await settled;
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(
        results.filter(
          r => r.status === "rejected" && r.reason instanceof CircuitOpenError
        )
      ).toHaveLength(19);
    });

    it("hands the probe to the next caller when the lease lapses", async () => {
      const config = {
        name: `lease-${seq}`,
        failureThreshold: 1,
        failureRate: 1,
        windowMs: 10_000,
        cooldownMs: 1_000,
        timeoutMs: 1_000,
      };
      await store.record(config, now, { outcome: "failure", probeId: null });
      now += 1_000;
      const first = await store.acquire(config, now, { probeId: "a" });
      expect(first.probeId).toBe("a");
      expect((await store.acquire(config, now, { probeId: "b" })).allowed).toBe(
        false
      );
      // Probe lease = timeout + 1s margin.
      now += 2_000;
      const second = await store.acquire(config, now, { probeId: "c" });
      expect(second.probeId).toBe("c");
      // The abandoned probe's late report is ignored.
      const late = await store.record(config, now, {
        outcome: "success",
        probeId: "a",
      });
      expect(late).toEqual({ state: "half_open", transitioned: false });
    });
  });

  describe("timeout", () => {
    it("aborts a slow call, fails it and counts it towards the threshold", async () => {
      const b = breaker({ timeoutMs: 50, failureThreshold: 2 });
      let signal: AbortSignal | undefined;
      const slow = (s: AbortSignal) => {
        signal = s;
        return new Promise<string>(() => undefined);
      };
      const started = Date.now();
      await expect(b.execute(slow)).rejects.toBeInstanceOf(
        DownstreamTimeoutError
      );
      expect(Date.now() - started).toBeLessThan(1_000);
      expect(signal?.aborted).toBe(true);
      await expect(b.execute(slow)).rejects.toBeInstanceOf(
        DownstreamTimeoutError
      );
      expect(await b.state()).toBe("open");
    });
  });

  describe("independence", () => {
    it("tripping one dependency's breaker leaves the other closed", async () => {
      const horizon = breaker({ name: `horizon-${seq}` });
      const mux = breaker({ name: `mux-${seq}` });
      await trip(horizon);
      await expect(mux.execute(() => Promise.resolve("mux ok"))).resolves.toBe(
        "mux ok"
      );
      expect(await mux.state()).toBe("closed");

      await trip(mux);
      now += 5_000;
      await expect(horizon.execute(() => Promise.resolve("h"))).resolves.toBe(
        "h"
      );
      expect(await horizon.state()).toBe("closed");
      expect(await mux.state()).toBe("open");
    });
  });
});

describe("Redis store degradation", () => {
  const config: CircuitBreakerConfig = {
    name: "degraded",
    failureThreshold: 1,
    failureRate: 1,
    windowMs: 10_000,
    cooldownMs: 5_000,
    timeoutMs: 1_000,
  };

  it("falls back to the per-instance store when Redis errors", async () => {
    const fallback = createMemoryBreakerStore();
    const redis = {
      eval: jest.fn().mockRejectedValue(new Error("upstash down")),
      hget: jest.fn().mockRejectedValue(new Error("upstash down")),
    };
    const store = createRedisBreakerStore(redis as never, fallback);
    await store.record(config, 0, { outcome: "failure", probeId: null });
    expect(await fallback.peek(config, 0)).toBe("open");
    expect((await store.acquire(config, 1, { probeId: "p" })).allowed).toBe(
      false
    );
  });

  it("does not wait on a Redis that stops answering", async () => {
    const redis = {
      eval: jest.fn(() => new Promise(() => undefined)),
      hget: jest.fn(() => new Promise(() => undefined)),
    };
    const store = createRedisBreakerStore(
      redis as never,
      createMemoryBreakerStore()
    );
    const started = Date.now();
    const permit = await store.acquire(config, 0, { probeId: "p" });
    expect(permit.allowed).toBe(true);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("passes the scripts' results through when Redis answers", async () => {
    const redis = {
      eval: jest
        .fn()
        .mockResolvedValueOnce([0, "open", 0, 1234])
        .mockResolvedValueOnce(["open", 1]),
      hget: jest.fn().mockResolvedValue("half_open"),
    };
    const store = createRedisBreakerStore(
      redis as never,
      createMemoryBreakerStore()
    );
    expect(await store.acquire(config, 0, { probeId: "p" })).toEqual({
      allowed: false,
      state: "open",
      probeId: null,
      retryAfterMs: 1234,
    });
    expect(
      await store.record(config, 0, { outcome: "failure", probeId: null })
    ).toEqual({ state: "open", transitioned: true });
    expect(await store.peek(config, 0)).toBe("half_open");
    const [, keys] = redis.eval.mock.calls[0];
    expect(keys).toEqual(["cb:{degraded}:state"]);
  });
});

describe("failure classification", () => {
  it.each([
    [httpError(500), "server_error"],
    [httpError(503), "server_error"],
    [httpError(429), "rate_limited"],
    [httpError(408), "timeout"],
    [httpError(404), "client_error"],
    [httpError(400), "client_error"],
    [Object.assign(new Error("x"), { status: 502 }), "server_error"],
    [Object.assign(new Error("aborted"), { code: "ECONNABORTED" }), "timeout"],
    [new Error("fetch failed"), "network"],
    [new DownstreamTimeoutError("horizon", 10), "timeout"],
  ])("%p -> %s", (error, kind) => {
    expect(classifyFailure(error)).toBe(kind);
  });
});

describe("configuration", () => {
  it("rejects configuration that would disable protection", () => {
    const base = { ...HORIZON_BREAKER_DEFAULTS };
    expect(() => new CircuitBreaker({ ...base, failureThreshold: 0 })).toThrow(
      /failureThreshold/
    );
    expect(() => new CircuitBreaker({ ...base, timeoutMs: NaN })).toThrow(
      /timeoutMs/
    );
    expect(() => new CircuitBreaker({ ...base, failureRate: 1.5 })).toThrow(
      /failureRate/
    );
  });

  it("applies valid env overrides and keeps defaults for invalid ones", () => {
    const config = breakerConfigFromEnv(MUX_BREAKER_DEFAULTS, {
      CB_MUX_TIMEOUT_MS: "4000",
      CB_MUX_FAILURE_THRESHOLD: "0",
      CB_MUX_FAILURE_RATE: "abc",
      CB_HORIZON_TIMEOUT_MS: "1",
    });
    expect(config).toEqual({ ...MUX_BREAKER_DEFAULTS, timeoutMs: 4000 });
  });

  it("gives Horizon and Mux separate names, so separate state", () => {
    expect(HORIZON_BREAKER_DEFAULTS.name).not.toBe(MUX_BREAKER_DEFAULTS.name);
  });
});
