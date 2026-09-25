/**
 * @jest-environment node
 */
const limitMock = jest.fn();
jest.mock("@upstash/ratelimit", () => {
  const Ratelimit = jest.fn().mockImplementation(() => ({ limit: limitMock }));
  (Ratelimit as unknown as { slidingWindow: jest.Mock }).slidingWindow =
    jest.fn();
  return { Ratelimit };
});

import { Ratelimit } from "@upstash/ratelimit";
import { resetUpstashRedisForTests } from "@/lib/upstash-redis";
import {
  createRateLimit,
  createRateLimiter,
  tooManyRequests,
} from "@/lib/rate-limit";

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("rate limiter (memory store)", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetUpstashRedisForTests();
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("allows normal usage up to the limit", async () => {
    const rl = createRateLimit({ limit: 3, windowMs: 60_000 }, clock());
    const results = [
      await rl.check("a"),
      await rl.check("a"),
      await rl.check("a"),
    ];
    expect(results.map(r => r.success)).toEqual([true, true, true]);
    expect(results.map(r => r.remaining)).toEqual([2, 1, 0]);
  });

  it("rejects a burst beyond the limit with retry guidance", async () => {
    const c = clock();
    const rl = createRateLimit({ limit: 3, windowMs: 60_000 }, c);
    const burst = await Promise.all(
      Array.from({ length: 10 }, () => rl.check("a"))
    );
    expect(burst.filter(r => r.success)).toHaveLength(3);

    c.advance(15_000);
    const blocked = await rl.check("a");
    expect(blocked.success).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(45);
  });

  it("resets after the window", async () => {
    const c = clock();
    const rl = createRateLimit({ limit: 1, windowMs: 1_000 }, c);
    await rl.check("a");
    expect((await rl.check("a")).success).toBe(false);
    c.advance(1_000);
    expect((await rl.check("a")).success).toBe(true);
  });

  it("isolates identities", async () => {
    const rl = createRateLimit({ limit: 1, windowMs: 60_000 }, clock());
    expect((await rl.check("admin-1")).success).toBe(true);
    expect((await rl.check("admin-1")).success).toBe(false);
    expect((await rl.check("admin-2")).success).toBe(true);
  });

  it("keeps the legacy boolean API", async () => {
    const isRateLimited = createRateLimiter(60_000, 1);
    expect(await isRateLimited("ip")).toBe(false);
    expect(await isRateLimited("ip")).toBe(true);
  });

  it("builds a 429 in the API error shape with Retry-After", async () => {
    const rl = createRateLimit({ limit: 1, windowMs: 30_000 }, clock());
    await rl.check("a");
    const res = tooManyRequests(await rl.check("a"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("1");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toEqual({
      error: "Too many requests",
      retryAfter: 30,
    });
  });
});

describe("rate limiter (Upstash)", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "SENTINEL-TEST-TOKEN";
    resetUpstashRedisForTests();
    limitMock.mockReset();
    (Ratelimit as unknown as jest.Mock).mockClear();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetUpstashRedisForTests();
    jest.restoreAllMocks();
  });

  it("namespaces keys per limiter", () => {
    createRateLimit({
      namespace: "admin-analytics",
      limit: 30,
      windowMs: 60_000,
    });
    expect((Ratelimit as unknown as jest.Mock).mock.calls[0][0]).toMatchObject({
      prefix: "ratelimit:admin-analytics",
      analytics: false,
    });
  });

  it("maps the Upstash decision", async () => {
    const c = clock();
    limitMock.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: c.now() + 12_000,
    });
    const res = await createRateLimit(
      { namespace: "x", limit: 5, windowMs: 60_000 },
      c
    ).check("u");
    expect(res).toMatchObject({
      success: false,
      retryAfterSeconds: 12,
      degraded: false,
    });
  });

  it("degrades to the memory store when Upstash throws, still enforcing a limit", async () => {
    limitMock.mockRejectedValue(new Error("ECONNRESET"));
    const rl = createRateLimit(
      { namespace: "x", limit: 2, windowMs: 60_000 },
      clock()
    );
    const results = [
      await rl.check("u"),
      await rl.check("u"),
      await rl.check("u"),
    ];
    expect(results.map(r => r.success)).toEqual([true, true, false]);
    expect(results.every(r => r.degraded)).toBe(true);
  });

  it("degrades on an Upstash timeout instead of silently allowing", async () => {
    limitMock.mockResolvedValue({
      success: true,
      limit: 1,
      remaining: 1,
      reset: 0,
      reason: "timeout",
    });
    const rl = createRateLimit(
      { namespace: "x", limit: 1, windowMs: 60_000 },
      clock()
    );
    await rl.check("u");
    expect(await rl.check("u")).toMatchObject({
      success: false,
      degraded: true,
    });
  });
});
