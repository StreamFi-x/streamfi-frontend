import { NextRequest } from "next/server";
import { GET } from "./route";

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routesF/chat-participation");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("GET /api/routesF/chat-participation", () => {
  it("returns participation data for a stream", async () => {
    const res = await GET(makeGet({ stream_id: "stream-001" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.stream_id).toBe("stream-001");
    expect(typeof data.total_viewers).toBe("number");
    expect(typeof data.chatters).toBe("number");
    expect(typeof data.participation_percent).toBe("number");
  });

  it("chatters does not exceed total_viewers", async () => {
    const res = await GET(makeGet({ stream_id: "stream-abc" }));
    const data = await res.json();
    expect(data.chatters).toBeLessThanOrEqual(data.total_viewers);
  });

  it("participation_percent is between 0 and 100", async () => {
    const res = await GET(makeGet({ stream_id: "stream-xyz" }));
    const data = await res.json();
    expect(data.participation_percent).toBeGreaterThanOrEqual(0);
    expect(data.participation_percent).toBeLessThanOrEqual(100);
  });

  it("participation_percent equals chatters/total_viewers * 100 (rounded)", async () => {
    const res = await GET(makeGet({ stream_id: "stream-math" }));
    const data = await res.json();
    const expected = Math.round((data.chatters / data.total_viewers) * 10_000) / 100;
    expect(data.participation_percent).toBeCloseTo(expected, 2);
  });

  it("returns 400 when stream_id is missing", async () => {
    const res = await GET(makeGet({}));
    expect(res.status).toBe(400);
  });
});
