import { NextRequest } from "next/server";
import { GET } from "./route";

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routesF/geo-viewer-distribution");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("GET /api/routesF/geo-viewer-distribution", () => {
  it("returns geographic distribution for a stream", async () => {
    const res = await GET(makeGet({ stream_id: "stream-001" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.stream_id).toBe("stream-001");
    expect(Array.isArray(data.by_country)).toBe(true);
    expect(data.by_country.length).toBeGreaterThan(0);
  });

  it("each country entry has country, viewers, and percent", async () => {
    const res = await GET(makeGet({ stream_id: "stream-geo" }));
    const data = await res.json();
    for (const c of data.by_country) {
      expect(typeof c.country).toBe("string");
      expect(typeof c.viewers).toBe("number");
      expect(typeof c.percent).toBe("number");
    }
  });

  it("countries are sorted by viewers descending", async () => {
    const res = await GET(makeGet({ stream_id: "stream-sort" }));
    const data = await res.json();
    for (let i = 1; i < data.by_country.length; i++) {
      expect(data.by_country[i - 1].viewers).toBeGreaterThanOrEqual(data.by_country[i].viewers);
    }
  });

  it("percent values sum to approximately 100", async () => {
    const res = await GET(makeGet({ stream_id: "stream-sum" }));
    const data = await res.json();
    const total = data.by_country.reduce((acc: number, c: { percent: number }) => acc + c.percent, 0);
    expect(total).toBeGreaterThan(95);
    expect(total).toBeLessThanOrEqual(100.5);
  });

  it("returns 400 when stream_id is missing", async () => {
    const res = await GET(makeGet({}));
    expect(res.status).toBe(400);
  });
});
