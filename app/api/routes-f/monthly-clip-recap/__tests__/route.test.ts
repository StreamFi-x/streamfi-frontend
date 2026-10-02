import { NextRequest } from "next/server";
import { GET } from "../route";

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routes-f/monthly-clip-recap");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("GET /api/routes-f/monthly-clip-recap", () => {
  it("returns a recap for a known month", async () => {
    const res = await GET(makeGet({ creator_id: "creator-123", year: "2025", month: "3" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.creator_id).toBe("creator-123");
    expect(data.year).toBe(2025);
    expect(data.month).toBe(3);
    expect(Array.isArray(data.top_clips)).toBe(true);
    expect(data.top_clips.length).toBeGreaterThan(0);
  });

  it("top_clips are sorted by views descending", async () => {
    const res = await GET(makeGet({ creator_id: "creator-abc", year: "2025", month: "6" }));
    const data = await res.json();
    for (let i = 1; i < data.top_clips.length; i++) {
      expect(data.top_clips[i - 1].views).toBeGreaterThanOrEqual(data.top_clips[i].views);
    }
  });

  it("total_views equals sum of clip views", async () => {
    const res = await GET(makeGet({ creator_id: "creator-xyz", year: "2025", month: "1" }));
    const data = await res.json();
    const sumViews = data.top_clips.reduce((acc: number, c: { views: number }) => acc + c.views, 0);
    expect(data.total_views).toBe(sumViews);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeGet({ year: "2025", month: "1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when only year is provided without month", async () => {
    const res = await GET(makeGet({ creator_id: "creator-001", year: "2025" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid month", async () => {
    const res = await GET(makeGet({ creator_id: "creator-001", year: "2025", month: "13" }));
    expect(res.status).toBe(400);
  });

  it("defaults to the current UTC month when year/month are omitted", async () => {
    const res = await GET(makeGet({ creator_id: "creator-now" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    const now = new Date();
    expect(data.year).toBe(now.getUTCFullYear());
    expect(data.month).toBe(now.getUTCMonth() + 1);
  });
});
