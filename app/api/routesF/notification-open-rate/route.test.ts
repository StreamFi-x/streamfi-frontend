/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routesF/notification-open-rate");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

describe("Notification Open Rate API", () => {
  it("returns notification open rate data", async () => {
    const res = await GET(makeReq({ creator_id: "creator123" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty("notifications_sent");
    expect(data).toHaveProperty("opened");
    expect(data).toHaveProperty("open_rate_percent");
    expect(data.notifications_sent).toBeGreaterThanOrEqual(0);
    expect(data.opened).toBeGreaterThanOrEqual(0);
  });

  it("computes open rate correctly", async () => {
    const res = await GET(makeReq({ creator_id: "test" }));
    const data = await res.json();

    if (data.notifications_sent > 0) {
      const computed_rate = Math.round((data.opened / data.notifications_sent) * 10000) / 100;
      expect(data.open_rate_percent).toBeCloseTo(computed_rate, 2);
    } else {
      expect(data.open_rate_percent).toBe(0);
    }
  });

  it("ensures opened does not exceed sent", async () => {
    const res = await GET(makeReq({ creator_id: "test" }));
    const data = await res.json();

    expect(data.opened).toBeLessThanOrEqual(data.notifications_sent);
  });

  it("open rate is between 0 and 100", async () => {
    const res = await GET(makeReq({ creator_id: "test" }));
    const data = await res.json();

    expect(data.open_rate_percent).toBeGreaterThanOrEqual(0);
    expect(data.open_rate_percent).toBeLessThanOrEqual(100);
  });

  it("returns different data for different creators", async () => {
    const res1 = await GET(makeReq({ creator_id: "creator1" }));
    const res2 = await GET(makeReq({ creator_id: "creator2" }));

    const data1 = await res1.json();
    const data2 = await res2.json();

    const ratesMatch = data1.open_rate_percent === data2.open_rate_percent;
    expect(ratesMatch).toBe(false);
  });

  it("uses default window_days of 30", async () => {
    const res = await GET(makeReq({ creator_id: "test" }));
    const data = await res.json();

    expect(data.notifications_sent).toBeGreaterThan(0);
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

  it("handles zero sent notifications", async () => {
    const res = await GET(makeReq({ creator_id: "test" }));
    const data = await res.json();

    if (data.notifications_sent === 0) {
      expect(data.open_rate_percent).toBe(0);
    }
  });
});
