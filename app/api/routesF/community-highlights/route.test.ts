import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/routesF/community-highlights");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("Community Highlights API", () => {
  it("returns highlights with required fields", async () => {
    const res = await GET(makeReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data.highlights)).toBe(true);
    expect(typeof data.total).toBe("number");
    expect(typeof data.window_days).toBe("number");
    expect(data.highlights.length).toBe(data.total);
  });

  it("each highlight has required fields", async () => {
    const res = await GET(makeReq());
    const data = await res.json();

    for (const h of data.highlights) {
      expect(h).toHaveProperty("highlight_id");
      expect(h).toHaveProperty("title");
      expect(h).toHaveProperty("creator_id");
      expect(h).toHaveProperty("creator_username");
      expect(h).toHaveProperty("votes");
      expect(h).toHaveProperty("category");
      expect(h).toHaveProperty("created_at");
    }
  });

  it("highlights are sorted by votes descending", async () => {
    const res = await GET(makeReq({ window_days: "90" }));
    const data = await res.json();

    for (let i = 1; i < data.highlights.length; i++) {
      expect(data.highlights[i - 1].votes).toBeGreaterThanOrEqual(data.highlights[i].votes);
    }
  });

  it("filters by window_days — shorter window returns fewer results", async () => {
    const res7 = await GET(makeReq({ window_days: "7" }));
    const res30 = await GET(makeReq({ window_days: "30" }));

    const data7 = await res7.json();
    const data30 = await res30.json();

    expect(data7.total).toBeLessThanOrEqual(data30.total);
  });

  it("filters by category", async () => {
    const res = await GET(makeReq({ window_days: "90", category: "gaming" }));
    const data = await res.json();

    for (const h of data.highlights) {
      expect(h.category).toBe("gaming");
    }
  });

  it("respects limit parameter", async () => {
    const res = await GET(makeReq({ window_days: "90", limit: "3" }));
    const data = await res.json();

    expect(data.highlights.length).toBeLessThanOrEqual(3);
  });

  it("returns window_days in response matching the query", async () => {
    const res = await GET(makeReq({ window_days: "14" }));
    const data = await res.json();

    expect(data.window_days).toBe(14);
  });

  it("returns empty list for category with no matches in window", async () => {
    const res = await GET(makeReq({ window_days: "1", category: "nonexistent" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.highlights).toHaveLength(0);
  });

  it("votes are non-negative integers", async () => {
    const res = await GET(makeReq({ window_days: "90" }));
    const data = await res.json();

    for (const h of data.highlights) {
      expect(h.votes).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(h.votes)).toBe(true);
    }
  });
});
