/**
 * Routes-F search endpoint tests.
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

import { GET } from "../search/route";
import {
  __test__setRoutesFRecords,
  getRoutesFRecords,
} from "@/lib/routes-f/store";
import { __test__resetRateLimit } from "@/lib/routes-f/rate-limit";
import { __test__resetCache } from "@/lib/routes-f/cache";

const makeRequest = (search = "", headers?: HeadersInit) =>
  new Request(`http://localhost/api/routes-f/search${search}`, {
    headers,
  });

const originalEnv = { ...process.env };
const initialRecords = getRoutesFRecords();

describe("GET /api/routes-f/search", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    __test__resetRateLimit();
    __test__resetCache();
  });

  it("returns recent items when query is empty", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
  });

  it("filters by tag", async () => {
    __test__setRoutesFRecords([
      {
        id: "rf-a",
        title: "Alpha",
        description: "First",
        tags: ["alpha"],
        createdAt: "2026-02-22T00:00:00.000Z",
      },
      {
        id: "rf-b",
        title: "Beta",
        description: "Second",
        tags: ["beta"],
        createdAt: "2026-02-23T00:00:00.000Z",
      },
    ]);

    const res = await GET(makeRequest("?tag=beta"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].id).toBe("rf-b");
  });

  it("supports query + tag combinations", async () => {
    __test__setRoutesFRecords([
      {
        id: "rf-1",
        title: "Cache Plan",
        description: "Strategy",
        tags: ["cache"],
        createdAt: "2026-02-22T00:00:00.000Z",
      },
      {
        id: "rf-2",
        title: "Cache Metrics",
        description: "Stats",
        tags: ["metrics"],
        createdAt: "2026-02-23T00:00:00.000Z",
      },
    ]);

    const res = await GET(makeRequest("?q=cache&tag=cache"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].id).toBe("rf-1");
  });

  it("returns 429 when rate limit exceeded", async () => {
    process.env.ROUTES_F_RATE_LIMIT = "1";
    process.env.ROUTES_F_RATE_LIMIT_WINDOW_SECONDS = "60";

    const headers = { "x-forwarded-for": "203.0.113.10" };
    await GET(makeRequest("", headers));
    const res = await GET(makeRequest("", headers));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns cache hit after first request when enabled", async () => {
    process.env.ROUTES_F_CACHE_ENABLED = "true";
    process.env.ROUTES_F_CACHE_TTL_SECONDS = "60";

    const res1 = await GET(makeRequest("?q=cache"));
    expect(res1.headers.get("X-Cache")).toBe("MISS");

    const res2 = await GET(makeRequest("?q=cache"));
    expect(res2.headers.get("X-Cache")).toBe("HIT");
  });

  afterAll(() => {
    __test__setRoutesFRecords(initialRecords);
    process.env = { ...originalEnv };
  });
});
