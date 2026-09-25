import { NextRequest } from "next/server";
import { GET } from "./route";

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routesF/tips-per-viewer");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("GET /api/routesF/tips-per-viewer", () => {
  it("returns stream data for a creator", async () => {
    const res = await GET(makeGet({ creator_id: "creator-001" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.creator_id).toBe("creator-001");
    expect(Array.isArray(data.streams)).toBe(true);
    expect(data.streams.length).toBeGreaterThan(0);
  });

  it("each stream has required fields", async () => {
    const res = await GET(makeGet({ creator_id: "creator-abc" }));
    const data = await res.json();
    for (const s of data.streams) {
      expect(typeof s.stream_id).toBe("string");
      expect(typeof s.viewers).toBe("number");
      expect(typeof s.tips_usdc).toBe("number");
      expect(typeof s.tips_per_viewer_usdc).toBe("number");
    }
  });

  it("streams are sorted by tips_per_viewer_usdc descending", async () => {
    const res = await GET(makeGet({ creator_id: "creator-xyz" }));
    const data = await res.json();
    for (let i = 1; i < data.streams.length; i++) {
      expect(data.streams[i - 1].tips_per_viewer_usdc).toBeGreaterThanOrEqual(
        data.streams[i].tips_per_viewer_usdc,
      );
    }
  });

  it("tips_per_viewer_usdc equals tips_usdc / viewers (rounded)", async () => {
    const res = await GET(makeGet({ creator_id: "creator-test" }));
    const data = await res.json();
    for (const s of data.streams) {
      const expected = Math.round((s.tips_usdc / s.viewers) * 100) / 100;
      expect(s.tips_per_viewer_usdc).toBeCloseTo(expected, 2);
    }
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeGet({}));
    expect(res.status).toBe(400);
  });
});
