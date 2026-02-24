/**
 * Routes-F endpoints tests.
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      }),
  },
}));

import { GET as healthGET } from "../health/route";

const makeRequest = (method: string, path: string) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  });

describe("GET /api/routes-f/health", () => {
  it("returns ok status with no-store cache control", async () => {
    const res = await healthGET(makeRequest("GET", "/api/routes-f/health"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBeDefined();
    expect(body.timestamp).toBeDefined();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("adds x-request-id header when missing", async () => {
    const res = await healthGET(makeRequest("GET", "/api/routes-f/health"));
    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();
  });
});
