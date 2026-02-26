/**
 * Routes-F dependency health endpoint tests.
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => {
      const headers = new Headers(init?.headers);
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify(body), {
        ...init,
        headers,
      });
    },
  },
}));

import { GET } from "../deps/route";
import { __test__resetCircuitBreaker } from "@/lib/routes-f/circuit-breaker";

const makeRequest = (search = "") =>
  new Request(`http://localhost/api/routes-f/deps${search}`);

const originalEnv = { ...process.env };

describe("GET /api/routes-f/deps", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    __test__resetCircuitBreaker();
  });

  it("returns stable healthy dependency payload", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.healthy).toBe(true);
    expect(Array.isArray(body.deps)).toBe(true);
    expect(body.deps[0]).toHaveProperty("key");
    expect(body.deps[0]).toHaveProperty("healthy");
    expect(body.deps[0]).toHaveProperty("latencyMs");
    expect(body.deps[0]).toHaveProperty("checkedAt");
  });

  it("returns retry hint when checks are short-circuited", async () => {
    process.env.ROUTES_F_CIRCUIT_BREAKER_THRESHOLD = "2";
    process.env.ROUTES_F_CIRCUIT_BREAKER_COOLDOWN_MS = "60000";

    await GET(makeRequest("?fail=auth-service"));
    await GET(makeRequest("?fail=auth-service"));
    const shortCircuited = await GET(makeRequest());

    expect(shortCircuited.status).toBe(503);
    const body = await shortCircuited.json();
    expect(body.error).toContain("short-circuited");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(body.circuitState).toBe("open");
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });
});
