jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { GET } from "../route";

const makeRequest = (search: string): import("next/server").NextRequest =>
  new Request(
    `http://localhost/api/routes-f/viewer-retention${search}`
  ) as unknown as import("next/server").NextRequest;

describe("GET /api/routes-f/viewer-retention — validation", () => {
  it("returns 400 when stream_id is missing", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/routes-f/viewer-retention — not found", () => {
  it("returns 404 for unknown stream", async () => {
    const res = await GET(makeRequest("?stream_id=unknown"));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/routes-f/viewer-retention — retention curve", () => {
  it("returns points array with correct shape", async () => {
    const res = await GET(makeRequest("?stream_id=stream_001"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.points)).toBe(true);
    expect(body.points).toHaveLength(5);
    const first = body.points[0];
    expect(first).toHaveProperty("minute");
    expect(first).toHaveProperty("percent_of_peak");
    expect(first).toHaveProperty("viewer_count");
  });

  it("normalizes peak minute to 100%", async () => {
    const res = await GET(makeRequest("?stream_id=stream_001"));
    const body = await res.json();
    const maxPercent = Math.max(
      ...body.points.map((p: { percent_of_peak: number }) => p.percent_of_peak)
    );
    expect(maxPercent).toBe(100);
  });

  it("shows strong drop-off for stream_001", async () => {
    const res = await GET(makeRequest("?stream_id=stream_001"));
    const body = await res.json();
    const last = body.points[body.points.length - 1];
    expect(last.percent_of_peak).toBeLessThan(20);
  });

  it("shows steady audience for stream_002", async () => {
    const res = await GET(makeRequest("?stream_id=stream_002"));
    const body = await res.json();
    const percents = body.points.map(
      (p: { percent_of_peak: number }) => p.percent_of_peak
    );
    const min = Math.min(...percents);
    expect(min).toBeGreaterThanOrEqual(90);
  });
});