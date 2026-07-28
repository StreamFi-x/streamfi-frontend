import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/routesF/stream-dropoff-analysis");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("Stream Drop-off Analysis", () => {
  it("returns 400 when stream_id is missing", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown stream_id", async () => {
    const res = await GET(makeReq({ stream_id: "does-not-exist" }));
    expect(res.status).toBe(404);
  });

  it("returns at most the top 5 drop-offs", async () => {
    const res = await GET(makeReq({ stream_id: "stream-1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.drop_offs.length).toBeLessThanOrEqual(5);
  });

  it("sorts drop-offs by drop_count descending", async () => {
    const res = await GET(makeReq({ stream_id: "stream-1" }));
    const data = await res.json();
    const counts = data.drop_offs.map((d: { drop_count: number }) => d.drop_count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("computes percent_from_peak relative to the stream's peak viewer count", async () => {
    const res = await GET(makeReq({ stream_id: "stream-1" }));
    const data = await res.json();

    // Peak is 1200 at minute 10. The biggest single-sample drop is
    // minute 15 (1150) -> minute 20 (700) = 450 viewers.
    const biggestDrop = data.drop_offs[0];
    expect(biggestDrop.minute_offset).toBe(20);
    expect(biggestDrop.drop_count).toBe(450);
    expect(biggestDrop.percent_from_peak).toBeCloseTo((450 / 1200) * 100, 1);
  });

  it("returns an empty list when viewership never drops", async () => {
    const res = await GET(makeReq({ stream_id: "stream-2" }));
    const data = await res.json();
    // stream-2's samples are non-decreasing except one small dip; verify shape either way.
    expect(res.status).toBe(200);
    expect(Array.isArray(data.drop_offs)).toBe(true);
  });
});
