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
import { POST as validatePOST } from "../validate/route";
import { POST as importPOST } from "../import/route";

const makeRequest = (method: string, path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
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

describe("POST /api/routes-f/validate", () => {
  it("returns 200 for valid payload", async () => {
    const payload = { name: "Route Alpha", path: "/alpha", method: "GET" };
    const res = await validatePOST(
      makeRequest("POST", "/api/routes-f/validate", payload)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isValid).toBe(true);
  });

  it("returns 422 for invalid payload", async () => {
    const payload = { path: "alpha", method: "INVALID" };
    const res = await validatePOST(
      makeRequest("POST", "/api/routes-f/validate", payload)
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.isValid).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);
  });
});

describe("POST /api/routes-f/import", () => {
  it("returns 207 when mixed validity", async () => {
    const payload = [
      { name: "Route A", path: "/a", method: "GET" },
      { name: "", path: "b", method: "POST" },
    ];
    const res = await importPOST(
      makeRequest("POST", "/api/routes-f/import", payload)
    );
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.results).toHaveLength(2);
  });

  it("returns 422 when all invalid", async () => {
    const payload = [{ name: "", path: "b", method: "POST" }];
    const res = await importPOST(
      makeRequest("POST", "/api/routes-f/import", payload)
    );
    expect(res.status).toBe(422);
  });
});
