import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routesF/net-follower-growth");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

describe("Net Follower Growth API", () => {
  it("returns follower growth data for a creator", async () => {
    const res = await GET(makeReq({ creator_id: "creator123" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty("gained");
    expect(data).toHaveProperty("lost");
    expect(data).toHaveProperty("net");
    expect(data).toHaveProperty("daily_series");
    expect(data.gained).toBeGreaterThanOrEqual(0);
    expect(data.lost).toBeGreaterThanOrEqual(0);
  });

  it("computes net correctly", async () => {
    const res = await GET(makeReq({ creator_id: "test" }));
    const data = await res.json();

    const computed_net = data.gained - data.lost;
    expect(data.net).toBe(computed_net);
  });

  it("handles positive net growth", async () => {
    const res = await GET(makeReq({ creator_id: "growth" }));
    const data = await res.json();

    expect(data.gained).toBeGreaterThan(0);
  });

  it("handles negative net growth", async () => {
    const res = await GET(makeReq({ creator_id: "decline" }));
    const data = await res.json();

    expect(data.lost).toBeGreaterThan(0);
  });

  it("provides daily series breakdown", async () => {
    const res = await GET(makeReq({ creator_id: "creator123" }));
    const data = await res.json();

    expect(data.daily_series).toBeDefined();
    expect(data.daily_series.length).toBeGreaterThan(0);

    for (const day of data.daily_series) {
      expect(day).toHaveProperty("date");
      expect(day).toHaveProperty("net_change");
    }
  });

  it("uses default window_days of 30", async () => {
    const res = await GET(makeReq({ creator_id: "test" }));
    const data = await res.json();

    expect(data.daily_series.length).toBeGreaterThan(0);
  });

  it("accepts custom window_days", async () => {
    const res = await GET(makeReq({ creator_id: "test", window_days: "60" }));
    const data = await res.json();

    expect(res.status).toBe(200);
  });

  it("clamps window_days to maximum 365", async () => {
    const res = await GET(makeReq({ creator_id: "test", window_days: "1000" }));
    expect(res.status).toBe(200);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when creator_id is empty", async () => {
    const res = await GET(makeReq({ creator_id: "" }));
    expect(res.status).toBe(400);
  });

  it("sums daily series to match totals", async () => {
    const res = await GET(makeReq({ creator_id: "test" }));
    const data = await res.json();

    let sumGained = 0;
    let sumLost = 0;

    for (const day of data.daily_series) {
      if (day.net_change > 0) {
        sumGained += day.net_change;
      } else {
        sumLost += Math.abs(day.net_change);
      }
    }

    expect(sumGained).toBe(data.gained);
    expect(sumLost).toBe(data.lost);
  });
});
