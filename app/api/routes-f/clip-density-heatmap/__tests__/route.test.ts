import { NextRequest } from "next/server";
import { GET } from "../route";

function makeGet(streamId?: string): NextRequest {
  const url = streamId
    ? `http://localhost/api/routes-f/clip-density-heatmap?stream_id=${encodeURIComponent(
        streamId
      )}`
    : "http://localhost/api/routes-f/clip-density-heatmap";
  return new NextRequest(url);
}

describe("GET /api/routes-f/clip-density-heatmap", () => {
  it("returns 400 when stream_id is missing", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(400);
  });

  it("buckets clips into 1-minute buckets sorted by minute_offset", async () => {
    const res = await GET(makeGet("stream_dense"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.stream_id).toBe("stream_dense");
    expect(body.buckets).toEqual([
      { minute_offset: 0, clip_count: 2 },
      { minute_offset: 5, clip_count: 4 },
      { minute_offset: 10, clip_count: 1 },
    ]);
  });

  it("reports the minute with the most clips as the peak", async () => {
    const res = await GET(makeGet("stream_dense"));
    const body = await res.json();
    expect(body.peak_minute).toBe(5);
  });

  it("handles a stream with a single clip", async () => {
    const res = await GET(makeGet("stream_sparse"));
    const body = await res.json();
    expect(body.buckets).toEqual([{ minute_offset: 1, clip_count: 1 }]);
    expect(body.peak_minute).toBe(1);
  });

  it("returns empty buckets and a null peak for a stream with no clips", async () => {
    const res = await GET(makeGet("stream_no_clips"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.buckets).toEqual([]);
    expect(body.peak_minute).toBeNull();
  });
});
