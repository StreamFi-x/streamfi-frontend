import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(streamId: string | null) {
  const url = new URL("http://localhost/api/routesF/session-length-distribution");
  if (streamId !== null) {url.searchParams.set("stream_id", streamId);}
  return new NextRequest(url);
}

describe("GET /api/routesF/session-length-distribution", () => {
  // stream-1 seed durations sorted: [2, 4, 8, 12, 12, 18, 22, 25, 40, 45, 62, 70, 90] (n=13)
  it("computes avg_minutes for the seeded stream-1 durations", async () => {
    const res = await GET(makeReq("stream-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.avg_minutes).toBeCloseTo(31.54, 2);
  });

  it("computes median_minutes (nearest-rank p50) for stream-1", async () => {
    const res = await GET(makeReq("stream-1"));
    const data = await res.json();

    expect(data.median_minutes).toBe(22);
  });

  it("computes p90_minutes for stream-1", async () => {
    const res = await GET(makeReq("stream-1"));
    const data = await res.json();

    expect(data.p90_minutes).toBe(70);
  });

  it("buckets stream-1 durations into the expected ranges", async () => {
    const res = await GET(makeReq("stream-1"));
    const data = await res.json();

    const byRange = Object.fromEntries(data.buckets.map((b: { range: string; count: number }) => [b.range, b.count]));

    expect(byRange["0-5"]).toBe(2);
    expect(byRange["5-15"]).toBe(3);
    expect(byRange["15-30"]).toBe(3);
    expect(byRange["30-60"]).toBe(2);
    expect(byRange["60+"]).toBe(3);
  });

  it("bucket counts sum to the total number of sessions", async () => {
    const res = await GET(makeReq("stream-1"));
    const data = await res.json();

    const total = data.buckets.reduce((sum: number, b: { count: number }) => sum + b.count, 0);
    expect(total).toBe(13);
  });

  it("median is never greater than p90", async () => {
    const res = await GET(makeReq("stream-2"));
    const data = await res.json();

    expect(data.median_minutes).toBeLessThanOrEqual(data.p90_minutes);
  });

  it("is deterministic for an unknown stream_id", async () => {
    const res1 = await GET(makeReq("unknown-stream-xyz"));
    const res2 = await GET(makeReq("unknown-stream-xyz"));
    const data1 = await res1.json();
    const data2 = await res2.json();

    expect(data1).toEqual(data2);
  });

  it("returns 400 when stream_id is missing", async () => {
    const res = await GET(makeReq(null));
    expect(res.status).toBe(400);
  });
});
