import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(streamId: string | null) {
  const url = new URL("http://localhost/api/routesF/first-time-viewers");
  if (streamId !== null) url.searchParams.set("stream_id", streamId);
  return new NextRequest(url);
}

describe("GET /api/routesF/first-time-viewers", () => {
  it("returns first_time_count and first_time_viewers for a mix of first-time and returning viewers", async () => {
    const res = await GET(makeReq("stream-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.first_time_count).toBe(3);
    expect(data.first_time_viewers.sort()).toEqual(["viewer-1", "viewer-3", "viewer-5"].sort());
  });

  it("returns 0 first-time viewers when everyone is returning", async () => {
    const res = await GET(makeReq("stream-2"));
    const data = await res.json();

    expect(data.first_time_count).toBe(0);
    expect(data.first_time_viewers).toEqual([]);
  });

  it("returns all viewers as first-time when every visit is a first watch", async () => {
    const res = await GET(makeReq("stream-3"));
    const data = await res.json();

    expect(data.first_time_count).toBe(3);
    expect(data.first_time_viewers.sort()).toEqual(["viewer-10", "viewer-8", "viewer-9"].sort());
  });

  it("first_time_count always matches first_time_viewers.length", async () => {
    const res = await GET(makeReq("stream-1"));
    const data = await res.json();

    expect(data.first_time_count).toBe(data.first_time_viewers.length);
  });

  it("is deterministic for an unknown stream_id", async () => {
    const res1 = await GET(makeReq("unknown-stream-abc"));
    const res2 = await GET(makeReq("unknown-stream-abc"));
    const data1 = await res1.json();
    const data2 = await res2.json();

    expect(data1).toEqual(data2);
  });

  it("returns 400 when stream_id is missing", async () => {
    const res = await GET(makeReq(null));
    expect(res.status).toBe(400);
  });
});
