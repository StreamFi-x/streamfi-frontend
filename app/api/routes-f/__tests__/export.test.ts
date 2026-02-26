/**
 * Routes-F export endpoint tests.
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

import { GET } from "../export/route";
import { __test__resetRateLimit } from "@/lib/routes-f/rate-limit";
import { __test__resetCache } from "@/lib/routes-f/cache";

const makeRequest = (search = "") =>
  new Request(`http://localhost/api/routes-f/export${search}`);

const originalEnv = { ...process.env };

describe("GET /api/routes-f/export", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    __test__resetRateLimit();
    __test__resetCache();
  });

  it("returns JSON by default with apiVersion and data", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Content-Disposition")).toContain("routes-f-export.json");
    const body = await res.json();
    expect(body.apiVersion).toBeDefined();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns CSV when requested", async () => {
    const res = await GET(makeRequest("?format=csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("routes-f-export.csv");
    const body = await res.text();
    expect(body.split("\n")[0]).toContain("id,title,description");
  });
});
