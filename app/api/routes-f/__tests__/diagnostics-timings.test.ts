jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => {
      const headers = new Headers(init?.headers);
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify(body), { ...init, headers });
    },
  },
}));

import { GET } from "../diagnostics/timings/route";
import { recordTiming, __test__resetDiagnostics } from "@/lib/routes-f/diagnostics";

const makeRequest = () => new Request("http://localhost/api/routes-f/diagnostics/timings");

describe("GET /api/routes-f/diagnostics/timings", () => {
  beforeEach(() => __test__resetDiagnostics());

  it("returns aggregated stats and bounded store behavior", async () => {
    // populate timings
    recordTiming("route-a", 10);
    recordTiming("route-a", 20);
    recordTiming("route-a", 30);
    recordTiming("route-b", 100);
    recordTiming("route-b", 200);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.timings).toBeDefined();
    expect(body.timings["route-a"].min).toBe(10);
    expect(body.timings["route-a"].max).toBe(30);
    expect(body.timings["route-a"].count).toBe(3);
    expect(body.timings["route-b"].avg).toBeGreaterThan(100);
  });
});
