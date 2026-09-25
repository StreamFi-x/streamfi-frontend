import { NextRequest } from "next/server";
import { GET } from "./route";

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routesF/share-conversion");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("GET /api/routesF/share-conversion", () => {
  it("returns share conversion data", async () => {
    const res = await GET(makeGet({ stream_id: "stream-001" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.stream_id).toBe("stream-001");
    expect(Array.isArray(data.by_source)).toBe(true);
    expect(data.by_source.length).toBeGreaterThan(0);
  });

  it("each source entry has required fields", async () => {
    const res = await GET(makeGet({ stream_id: "stream-abc" }));
    const data = await res.json();
    for (const s of data.by_source) {
      expect(typeof s.source).toBe("string");
      expect(typeof s.shares).toBe("number");
      expect(typeof s.viewers).toBe("number");
      expect(typeof s.conversion_percent).toBe("number");
    }
  });

  it("viewers does not exceed shares", async () => {
    const res = await GET(makeGet({ stream_id: "stream-xyz" }));
    const data = await res.json();
    for (const s of data.by_source) {
      expect(s.viewers).toBeLessThanOrEqual(s.shares);
    }
  });

  it("conversion_percent matches viewers/shares ratio", async () => {
    const res = await GET(makeGet({ stream_id: "stream-math" }));
    const data = await res.json();
    for (const s of data.by_source) {
      if (s.shares > 0) {
        const expected = Math.round((s.viewers / s.shares) * 10_000) / 100;
        expect(s.conversion_percent).toBeCloseTo(expected, 2);
      }
    }
  });

  it("returns 400 when stream_id is missing", async () => {
    const res = await GET(makeGet({}));
    expect(res.status).toBe(400);
  });
});
