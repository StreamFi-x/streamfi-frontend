/**
 * Routes-F metrics endpoint tests.
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

import { GET } from "../metrics/route";
import { __test__resetMetrics } from "@/lib/routes-f/metrics";
import { __test__resetRateLimit } from "@/lib/routes-f/rate-limit";

const makeRequest = () =>
  new Request("http://localhost/api/routes-f/metrics");

describe("GET /api/routes-f/metrics", () => {
  beforeEach(() => {
    __test__resetMetrics();
    __test__resetRateLimit();
  });

  it("returns metric snapshot shape", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resetOnRestart).toBe(true);
    expect(body.totals).toHaveProperty("metrics");
    expect(body.last24h).toHaveProperty("metrics");
    expect(Array.isArray(body.series)).toBe(true);
  });
});
