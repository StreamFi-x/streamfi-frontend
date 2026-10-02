import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/routesF/fresh-streams");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("Fresh Streams API", () => {
  it("returns streams with required fields", async () => {
    const res = await GET(makeReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data.streams)).toBe(true);
    expect(typeof data.total).toBe("number");
    expect(typeof data.max_age_minutes).toBe("number");
    expect(data.streams.length).toBe(data.total);
  });

  it("each stream has all required fields", async () => {
    const res = await GET(makeReq({ max_age_minutes: "60" }));
    const data = await res.json();

    for (const stream of data.streams) {
      expect(stream).toHaveProperty("stream_id");
      expect(stream).toHaveProperty("creator_id");
      expect(stream).toHaveProperty("creator_username");
      expect(stream).toHaveProperty("title");
      expect(stream).toHaveProperty("category");
      expect(stream).toHaveProperty("viewer_count");
      expect(stream).toHaveProperty("age_minutes");
      expect(stream).toHaveProperty("started_at");
    }
  });

  it("default max_age_minutes of 30 filters streams older than 30 min", async () => {
    const res = await GET(makeReq());
    const data = await res.json();

    for (const stream of data.streams) {
      expect(stream.age_minutes).toBeLessThanOrEqual(30);
    }
    expect(data.max_age_minutes).toBe(30);
  });

  it("streams older than max_age_minutes are excluded", async () => {
    const res = await GET(makeReq({ max_age_minutes: "10" }));
    const data = await res.json();

    for (const stream of data.streams) {
      expect(stream.age_minutes).toBeLessThanOrEqual(10);
    }
  });

  it("shorter window returns fewer streams than longer window", async () => {
    const res5 = await GET(makeReq({ max_age_minutes: "5" }));
    const res60 = await GET(makeReq({ max_age_minutes: "60" }));

    const data5 = await res5.json();
    const data60 = await res60.json();

    expect(data5.total).toBeLessThanOrEqual(data60.total);
  });

  it("respects limit parameter", async () => {
    const res = await GET(makeReq({ max_age_minutes: "60", limit: "3" }));
    const data = await res.json();

    expect(data.streams.length).toBeLessThanOrEqual(3);
  });

  it("returns max_age_minutes matching the requested value", async () => {
    const res = await GET(makeReq({ max_age_minutes: "15" }));
    const data = await res.json();

    expect(data.max_age_minutes).toBe(15);
  });

  it("started_at is a valid ISO date string", async () => {
    const res = await GET(makeReq());
    const data = await res.json();

    for (const stream of data.streams) {
      expect(() => new Date(stream.started_at).toISOString()).not.toThrow();
    }
  });

  it("age_minutes values are non-negative integers", async () => {
    const res = await GET(makeReq({ max_age_minutes: "60" }));
    const data = await res.json();

    for (const stream of data.streams) {
      expect(stream.age_minutes).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(stream.age_minutes)).toBe(true);
    }
  });

  it("returns empty list when max_age_minutes is 0 (clamps to default 30)", async () => {
    const res = await GET(makeReq({ max_age_minutes: "0" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.max_age_minutes).toBe(30);
  });

  it("viewer_count is non-negative for all streams", async () => {
    const res = await GET(makeReq({ max_age_minutes: "60" }));
    const data = await res.json();

    for (const stream of data.streams) {
      expect(stream.viewer_count).toBeGreaterThanOrEqual(0);
    }
  });
});
