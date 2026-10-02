/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { bucketByMinute, computeVelocity, findPeakMinute } from "../velocity";
import { getChatStream } from "../seed";

function makeReq(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/chat-velocity${query}`
  );
}

describe("bucketByMinute", () => {
  it("groups events into minute buckets", () => {
    const stream = getChatStream("stream_chat_1")!;
    const series = bucketByMinute(stream.events);
    expect(series[0]).toEqual({ minute_offset: 0, messages: 4 });
    expect(series[1]).toEqual({ minute_offset: 1, messages: 5 });
    expect(series[2]).toEqual({ minute_offset: 2, messages: 3 });
    expect(series[3]).toEqual({ minute_offset: 3, messages: 2 });
    expect(series[4]).toEqual({ minute_offset: 4, messages: 1 });
  });

  it("returns an empty series for no events", () => {
    expect(bucketByMinute([])).toEqual([]);
  });
});

describe("findPeakMinute", () => {
  it("returns the minute with the highest message count", () => {
    const stream = getChatStream("stream_chat_1")!;
    const series = bucketByMinute(stream.events);
    expect(findPeakMinute(series)).toBe(1);
  });
});

describe("computeVelocity", () => {
  it("computes series, peak_minute, and total_messages", () => {
    const stream = getChatStream("stream_chat_1")!;
    const result = computeVelocity(stream.events);
    expect(result.total_messages).toBe(15);
    expect(result.peak_minute).toBe(1);
    expect(result.series.reduce((sum, p) => sum + p.messages, 0)).toBe(15);
  });
});

describe("GET /api/routes-f/chat-velocity", () => {
  it("requires stream_id", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });

  it("404s for an unknown stream", async () => {
    const res = await GET(makeReq("?stream_id=nope"));
    expect(res.status).toBe(404);
  });

  it("returns velocity series for a stream", async () => {
    const res = await GET(makeReq("?stream_id=stream_chat_1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_messages).toBe(15);
    expect(body.peak_minute).toBe(1);
    expect(body.series[1].messages).toBe(5);
  });

  it("handles a stream with no chat", async () => {
    const res = await GET(makeReq("?stream_id=stream_chat_empty"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_messages).toBe(0);
    expect(body.series).toEqual([]);
    expect(body.peak_minute).toBe(0);
  });
});
