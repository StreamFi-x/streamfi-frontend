/**
 * Routes-F delay endpoint tests.
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

import { GET } from "../test/delay/route";

const makeRequest = (search = "") =>
  new Request(`http://localhost/api/routes-f/test/delay${search}`);

describe("GET /api/routes-f/test/delay", () => {
  it("returns 400 when ms parameter is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing required parameter: ms");
    expect(body.minDelay).toBe(0);
    expect(body.maxDelay).toBe(10000);
  });

  it("returns 400 for non-numeric ms value", async () => {
    const res = await GET(makeRequest("?ms=abc"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid delay value: must be a number");
    expect(body.provided).toBe("abc");
  });

  it("returns 400 for delay below minimum (negative)", async () => {
    const res = await GET(makeRequest("?ms=-1"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Delay out of range");
    expect(body.provided).toBe(-1);
  });

  it("returns 400 for delay above maximum", async () => {
    const res = await GET(makeRequest("?ms=10001"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Delay out of range");
    expect(body.provided).toBe(10001);
  });

  it("accepts minimum delay (0ms)", async () => {
    const res = await GET(makeRequest("?ms=0"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requestedDelay).toBe(0);
    expect(typeof body.actualDelay).toBe("number");
    expect(body.minDelay).toBe(0);
    expect(body.maxDelay).toBe(10000);
  });

  it("accepts maximum delay (10000ms)", async () => {
    const res = await GET(makeRequest("?ms=10000"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requestedDelay).toBe(10000);
  }, 15000);

  it("returns requestedDelay and actualDelay fields", async () => {
    const res = await GET(makeRequest("?ms=50"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("requestedDelay");
    expect(body).toHaveProperty("actualDelay");
    expect(body.requestedDelay).toBe(50);
    expect(body.actualDelay).toBeGreaterThanOrEqual(50);
  });

  it("actual delay is approximately equal to requested delay", async () => {
    const requestedMs = 100;
    const res = await GET(makeRequest(`?ms=${requestedMs}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Allow some tolerance for timing variance (within 50ms)
    expect(body.actualDelay).toBeGreaterThanOrEqual(requestedMs);
    expect(body.actualDelay).toBeLessThan(requestedMs + 50);
  });
});
