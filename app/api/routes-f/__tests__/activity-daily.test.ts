/**
 * Routes-F daily activity endpoint tests.
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

import { GET } from "../activity/daily/route";

const makeRequest = (search = "") =>
  new Request(`http://localhost/api/routes-f/activity/daily${search}`);

describe("GET /api/routes-f/activity/daily", () => {
  it("uses default day window when query param is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.days).toBe(7);
    expect(Array.isArray(body.perDay)).toBe(true);
    expect(body.perDay).toHaveLength(7);
  });

  it("enforces upper bound for days parameter", async () => {
    const res = await GET(makeRequest("?days=1000"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.days).toBe(body.limits.maxDays);
    expect(body.perDay).toHaveLength(body.limits.maxDays);
  });

  it("returns deterministic bucket shape and total count", async () => {
    const res = await GET(makeRequest("?days=5"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.perDay).toHaveLength(5);
    const sum = body.perDay.reduce((acc: number, item: { count: number }) => acc + item.count, 0);
    expect(body.totalCount).toBe(sum);
    expect(body.perDay[0]).toHaveProperty("date");
    expect(body.perDay[0]).toHaveProperty("count");
  });
});
