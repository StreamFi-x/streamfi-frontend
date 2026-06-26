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
    `http://localhost/api/routes-f/creator-dashboard${search}`
  ) as unknown as import("next/server").NextRequest;

describe("GET /api/routes-f/creator-dashboard — validation", () => {
  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/routes-f/creator-dashboard — not found", () => {
  it("returns 404 for unknown creator", async () => {
    const res = await GET(makeRequest("?creator_id=unknown_creator"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Creator not found");
  });
});

describe("GET /api/routes-f/creator-dashboard — aggregations", () => {
  it("returns correct stats for creator_001", async () => {
    const res = await GET(makeRequest("?creator_id=creator_001"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creator_id).toBe("creator_001");
    expect(body.follower_count).toBe(12500);
    expect(body.active_subs).toBe(318);
    expect(body.last_stream_at).toBe("2026-06-20T18:00:00.000Z");
  });

  it("rounds currency values to 2 decimal places", async () => {
    const res = await GET(makeRequest("?creator_id=creator_001"));
    const body = await res.json();
    expect(body.monthly_recurring_revenue_usdc).toBe(1847.5);
    expect(body.total_tips_lifetime_usdc).toBe(9234.75);
  });

  it("returns null last_stream_at for creator with no streams", async () => {
    const res = await GET(makeRequest("?creator_id=creator_002"));
    const body = await res.json();
    expect(body.last_stream_at).toBeNull();
    expect(body.follower_count).toBe(340);
    expect(body.active_subs).toBe(8);
  });
});