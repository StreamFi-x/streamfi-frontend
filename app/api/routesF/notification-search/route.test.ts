import { NextRequest } from "next/server";
import { GET } from "./route";

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routesF/notification-search");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("GET /api/routesF/notification-search", () => {
  it("returns all notifications when no query is provided", async () => {
    const res = await GET(makeGet({ viewer_id: "viewer-a" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.count).toBeGreaterThan(0);
  });

  it("matches notifications by keyword in title", async () => {
    const res = await GET(makeGet({ viewer_id: "viewer-a", q: "follower" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    for (const n of data.results) {
      expect(
        n.title.toLowerCase().includes("follower") || n.body.toLowerCase().includes("follower"),
      ).toBe(true);
    }
  });

  it("matches notifications by keyword in body", async () => {
    const res = await GET(makeGet({ viewer_id: "viewer-a", q: "XLM" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results.length).toBeGreaterThan(0);
    for (const n of data.results) {
      expect(
        n.title.toLowerCase().includes("xlm") || n.body.toLowerCase().includes("xlm"),
      ).toBe(true);
    }
  });

  it("is case-insensitive", async () => {
    const lower = await (await GET(makeGet({ viewer_id: "viewer-a", q: "stream" }))).json();
    const upper = await (await GET(makeGet({ viewer_id: "viewer-a", q: "STREAM" }))).json();
    expect(lower.count).toBe(upper.count);
  });

  it("returns empty results for a non-matching query", async () => {
    const res = await GET(makeGet({ viewer_id: "viewer-a", q: "zzznomatch" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toEqual([]);
    expect(data.count).toBe(0);
  });

  it("returns 400 when viewer_id is missing", async () => {
    const res = await GET(makeGet({ q: "follower" }));
    expect(res.status).toBe(400);
  });

  it("respects the limit parameter", async () => {
    const res = await GET(makeGet({ viewer_id: "viewer-a", limit: "2" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results.length).toBeLessThanOrEqual(2);
  });
});
