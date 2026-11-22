/**
 * @jest-environment node
 */
const mockSql = jest.fn();
const mockRedisPing = jest.fn();
const mockGetUpstashRedis = jest.fn();
const mockFetch = jest.fn();

jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

jest.mock("@/lib/upstash-redis", () => ({
  getUpstashRedis: () => mockGetUpstashRedis(),
}));

jest.mock("@/lib/tracing/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/health/route";
import { checkSystemHealth, verifyHealthCheckAuth } from "@/lib/health/check";
import { resetBreakerStoreForTests } from "@/lib/resilience/circuit-breaker";
import { resetBreakersForTests } from "@/lib/resilience/breakers";

describe("Per-dependency Health Check Endpoint (#1747)", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      MUX_TOKEN_ID: "test-mux-token-id",
      MUX_TOKEN_SECRET: "test-mux-token-secret",
    };
    delete process.env.HEALTH_CHECK_SECRET;
    resetBreakerStoreForTests();
    resetBreakersForTests();
    mockSql.mockReset().mockResolvedValue({ rows: [{ "?column?": 1 }] });
    mockRedisPing.mockReset().mockResolvedValue("PONG");
    mockGetUpstashRedis.mockReset().mockReturnValue({ ping: mockRedisPing });
    mockFetch.mockReset().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("reports healthy status (200) when database, Redis, Mux, and Stellar Horizon are all reachable", async () => {
    const req = new NextRequest("http://localhost:3000/api/health");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("no-store");

    const data = await res.json();
    expect(data.status).toBe("healthy");
    expect(data.db).toBe(true);
    expect(data.cache).toBe(true);
    expect(data.mux).toBe(true);
    expect(data.stellar).toBe(true);

    expect(data.dependencies.database.status).toBe("up");
    expect(data.dependencies.database.connected).toBe(true);
    expect(typeof data.dependencies.database.latencyMs).toBe("number");

    expect(data.dependencies.redis.status).toBe("up");
    expect(data.dependencies.redis.connected).toBe(true);

    expect(data.dependencies.mux.status).toBe("up");
    expect(data.dependencies.mux.connected).toBe(true);

    expect(data.dependencies.stellarHorizon.status).toBe("up");
    expect(data.dependencies.stellarHorizon.connected).toBe(true);
  });

  it("reports independent failure when only Mux is down while DB, Redis, and Stellar Horizon remain up", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (String(url).includes("api.mux.com")) {
        return { ok: false, status: 503 };
      }
      return { ok: true, status: 200 };
    });

    const req = new NextRequest("http://localhost:3000/api/health");
    const res = await GET(req);

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.status).toBe("degraded");
    expect(data.dependencies.database.status).toBe("up");
    expect(data.dependencies.redis.status).toBe("up");
    expect(data.dependencies.stellarHorizon.status).toBe("up");
    expect(data.dependencies.mux.status).toBe("down");
    expect(data.dependencies.mux.connected).toBe(false);
    expect(data.dependencies.mux.error).toContain("HTTP 503");
    expect(data.mux).toBe(false);
    expect(data.db).toBe(true);
    expect(data.stellar).toBe(true);
  });

  it("reports independent failure when only Stellar Horizon is down", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (String(url).includes("horizon")) {
        throw new Error("Horizon connection refused");
      }
      return { ok: true, status: 200 };
    });

    const req = new NextRequest("http://localhost:3000/api/health");
    const res = await GET(req);

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.status).toBe("degraded");
    expect(data.dependencies.stellarHorizon.status).toBe("down");
    expect(data.dependencies.stellarHorizon.error).toContain(
      "Horizon connection refused"
    );
    expect(data.dependencies.database.status).toBe("up");
    expect(data.dependencies.mux.status).toBe("up");
  });

  it("reports unhealthy status (503) when the database is down while other dependencies succeed", async () => {
    mockSql.mockRejectedValueOnce(new Error("Postgres connection terminated"));

    const req = new NextRequest("http://localhost:3000/api/health");
    const res = await GET(req);

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.status).toBe("unhealthy");
    expect(data.dependencies.database.status).toBe("down");
    expect(data.dependencies.database.error).toContain(
      "Postgres connection terminated"
    );
    expect(data.dependencies.mux.status).toBe("up");
    expect(data.dependencies.stellarHorizon.status).toBe("up");
  });

  it("reports Redis as unconfigured without failing overall health when Upstash env vars are absent", async () => {
    mockGetUpstashRedis.mockReturnValue(null);

    const report = await checkSystemHealth();
    expect(report.status).toBe("healthy");
    expect(report.dependencies.redis.status).toBe("unconfigured");
    expect(report.dependencies.redis.connected).toBe(false);
    expect(report.dependencies.database.status).toBe("up");
    expect(report.dependencies.mux.status).toBe("up");
    expect(report.dependencies.stellarHorizon.status).toBe("up");
  });

  it("reports degraded status when Redis is configured but unreachable", async () => {
    mockRedisPing.mockRejectedValueOnce(new Error("Upstash Redis 502"));

    const report = await checkSystemHealth();
    expect(report.status).toBe("degraded");
    expect(report.dependencies.redis.status).toBe("down");
    expect(report.dependencies.redis.error).toContain("Upstash Redis 502");
  });

  it("times out a hanging dependency independently without blocking others", async () => {
    const report = await checkSystemHealth({
      timeoutMs: 50,
      checkDatabase: async () => {},
      checkRedis: async () => "up",
      checkMux: () => new Promise(resolve => setTimeout(resolve, 500)),
      checkStellarHorizon: async () => {},
    });

    expect(report.status).toBe("degraded");
    expect(report.dependencies.database.status).toBe("up");
    expect(report.dependencies.stellarHorizon.status).toBe("up");
    expect(report.dependencies.mux.status).toBe("down");
    expect(report.dependencies.mux.error).toContain("timed out");
  });

  it("enforces authentication when HEALTH_CHECK_SECRET is configured", async () => {
    process.env.HEALTH_CHECK_SECRET = "monitoring-secret-token";

    const unauthReq = new NextRequest("http://localhost:3000/api/health");
    const unauthRes = await GET(unauthReq);
    expect(unauthRes.status).toBe(401);

    const wrongReq = new NextRequest("http://localhost:3000/api/health", {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect((await GET(wrongReq)).status).toBe(401);

    const bearerReq = new NextRequest("http://localhost:3000/api/health", {
      headers: { Authorization: "Bearer monitoring-secret-token" },
    });
    const bearerRes = await GET(bearerReq);
    expect(bearerRes.status).toBe(200);

    const headerReq = new NextRequest("http://localhost:3000/api/health", {
      headers: { "x-health-secret": "monitoring-secret-token" },
    });
    expect((await GET(headerReq)).status).toBe(200);
  });

  it("verifyHealthCheckAuth returns configured=false when secret is unset", () => {
    delete process.env.HEALTH_CHECK_SECRET;
    const req = new Request("http://localhost:3000/api/health");
    expect(verifyHealthCheckAuth(req)).toEqual({
      authorized: true,
      configured: false,
    });
  });
});
