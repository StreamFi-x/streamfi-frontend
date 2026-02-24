/**
 * Routes-F flags endpoint tests.
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { GET } from "../flags/route";
import { __test__resetRateLimit } from "@/lib/routes-f/rate-limit";

const makeRequest = (search = "") =>
  new Request(`http://localhost/api/routes-f/flags${search}`);

const originalEnv = { ...process.env };

describe("GET /api/routes-f/flags", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ROUTES_F_FLAG_SEARCH;
    delete process.env.ROUTES_F_FLAG_EXPORT;
    delete process.env.ROUTES_F_FLAG_METRICS;
    delete process.env.ROUTES_F_FLAG_MAINTENANCE;
    __test__resetRateLimit();
  });

  it("returns default flags as false", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flags).toEqual({
      enableSearch: false,
      enableExport: false,
      enableMetrics: false,
      enableMaintenance: false,
    });
  });

  it("accepts userId without error", async () => {
    const res = await GET(makeRequest("?userId=unknown"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("unknown");
  });
});
