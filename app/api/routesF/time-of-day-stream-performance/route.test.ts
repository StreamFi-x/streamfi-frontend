import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routesF/time-of-day-stream-performance");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

describe("Time of Day Stream Performance API", () => {
  it("returns hourly performance data for a creator", async () => {
    const res = await GET(makeReq({ creator_id: "creator123" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.hours).toBeDefined();
    expect(data.hours).toHaveLength(24);

    for (const hour of data.hours) {
      expect(hour).toHaveProperty("hour_utc");
      expect(hour).toHaveProperty("avg_viewers");
      expect(hour).toHaveProperty("stream_count");
      expect(hour.hour_utc).toBeGreaterThanOrEqual(0);
      expect(hour.hour_utc).toBeLessThan(24);
      expect(hour.avg_viewers).toBeGreaterThanOrEqual(0);
      expect(hour.stream_count).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns different data for different creators", async () => {
    const res1 = await GET(makeReq({ creator_id: "creator1" }));
    const res2 = await GET(makeReq({ creator_id: "creator2" }));

    const data1 = await res1.json();
    const data2 = await res2.json();

    const avgViewersMatch = data1.hours.every((h: any, i: number) => h.avg_viewers === data2.hours[i].avg_viewers);
    expect(avgViewersMatch).toBe(false);
  });

  it("aggregates multiple streams per hour correctly", async () => {
    const res = await GET(makeReq({ creator_id: "consistent" }));
    const data = await res.json();

    let totalStreams = 0;
    for (const hour of data.hours) {
      totalStreams += hour.stream_count;
    }

    expect(totalStreams).toBeGreaterThan(0);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when creator_id is empty", async () => {
    const res = await GET(makeReq({ creator_id: "" }));
    expect(res.status).toBe(400);
  });

  it("computes average viewers correctly", async () => {
    const res = await GET(makeReq({ creator_id: "test" }));
    const data = await res.json();

    for (const hour of data.hours) {
      if (hour.stream_count > 0) {
        expect(hour.avg_viewers).toBeGreaterThan(0);
      } else {
        expect(hour.avg_viewers).toBe(0);
      }
    }
  });
});
