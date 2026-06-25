import { NextRequest } from "next/server";
import { GET } from "../route";

function makeReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/routes-f/clips/most-liked");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

describe("GET /api/routes-f/clips/most-liked", () => {
  it("returns all clips sorted by likes descending with all-time timeframe", async () => {
    const res = await GET(makeReq({ timeframe: "all-time" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.clips)).toBe(true);
    expect(data.timeframe).toBe("all-time");
    // Should be sorted descending
    for (let i = 1; i < data.clips.length; i++) {
      expect(data.clips[i - 1].likes).toBeGreaterThanOrEqual(data.clips[i].likes);
    }
  });

  it("filters by 24h timeframe — only recent clips", async () => {
    const res = await GET(makeReq({ timeframe: "24h" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const clip of data.clips) {
      expect(clip.created_at).toBeGreaterThanOrEqual(cutoff);
    }
  });

  it("filters by 7d timeframe", async () => {
    const res = await GET(makeReq({ timeframe: "7d" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const clip of data.clips) {
      expect(clip.created_at).toBeGreaterThanOrEqual(cutoff);
    }
  });

  it("filters by 30d timeframe", async () => {
    const res = await GET(makeReq({ timeframe: "30d" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const clip of data.clips) {
      expect(clip.created_at).toBeGreaterThanOrEqual(cutoff);
    }
  });

  it("filters by creator_id", async () => {
    const res = await GET(makeReq({ creator_id: "creator_a", timeframe: "all-time" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const clip of data.clips) {
      expect(clip.creator_id).toBe("creator_a");
    }
  });

  it("respects limit param", async () => {
    const res = await GET(makeReq({ timeframe: "all-time", limit: "3" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.clips.length).toBeLessThanOrEqual(3);
  });

  it("assigns sequential rank starting at 1", async () => {
    const res = await GET(makeReq({ timeframe: "all-time" }));
    const data = await res.json();
    data.clips.forEach((clip: { rank: number }, idx: number) => {
      expect(clip.rank).toBe(idx + 1);
    });
  });

  it("returns 400 for invalid timeframe", async () => {
    const res = await GET(makeReq({ timeframe: "3months" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid timeframe/i);
  });

  it("returns 400 for invalid limit", async () => {
    const res = await GET(makeReq({ timeframe: "all-time", limit: "0" }));
    expect(res.status).toBe(400);
  });

  it("defaults to all-time when no timeframe given", async () => {
    const res = await GET(makeReq({}));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.timeframe).toBe("all-time");
  });
});
