/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { bucketStart, buildGrowthSeries } from "../buckets";
import { eventsForCreator } from "../seed";
import type { GrowthBucket } from "../types";

function makeReq(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/follower-growth${query}`
  );
}

describe("bucketStart", () => {
  it("buckets by day at midnight UTC", () => {
    expect(bucketStart("2026-01-03T18:30:00Z", "day")).toBe("2026-01-03");
  });

  it("buckets by month on the first", () => {
    expect(bucketStart("2026-02-21T11:00:00Z", "month")).toBe("2026-02-01");
  });

  it("buckets by week on the preceding Monday", () => {
    // 2026-01-03 is a Saturday -> week starts Monday 2025-12-29.
    expect(bucketStart("2026-01-03T10:00:00Z", "week")).toBe("2025-12-29");
  });

  it("keeps a Monday as its own week start", () => {
    // 2026-01-05 is a Monday.
    expect(bucketStart("2026-01-05T09:15:00Z", "week")).toBe("2026-01-05");
  });
});

describe("buildGrowthSeries", () => {
  const events = eventsForCreator("creator_a");

  it("produces a strictly cumulative (non-decreasing) count", () => {
    const { series } = buildGrowthSeries(events, "day");
    for (let i = 1; i < series.length; i++) {
      expect(series[i].count).toBeGreaterThanOrEqual(series[i - 1].count);
    }
  });

  it("final cumulative count equals the number of events", () => {
    const { series, total } = buildGrowthSeries(events, "month");
    expect(total).toBe(events.length);
    expect(series[series.length - 1].count).toBe(events.length);
  });

  it("orders buckets chronologically", () => {
    const { series } = buildGrowthSeries(events, "month");
    const starts = series.map(s => s.bucket_start);
    expect([...starts].sort()).toEqual(starts);
  });

  it("computes correct per-month cumulative values", () => {
    // creator_a: Jan=5, Feb=3, Mar=1 => cumulative 5, 8, 9.
    const { series } = buildGrowthSeries(events, "month");
    expect(series).toEqual<GrowthBucket[]>([
      { bucket_start: "2026-01-01", count: 5 },
      { bucket_start: "2026-02-01", count: 8 },
      { bucket_start: "2026-03-01", count: 9 },
    ]);
  });

  it("collapses same-day events into one bucket", () => {
    // Two creator_a follows on 2026-01-03.
    const { series } = buildGrowthSeries(events, "day");
    const jan3 = series.find(s => s.bucket_start === "2026-01-03");
    expect(jan3!.count).toBe(2);
  });

  it("returns an empty series and zero total for no events", () => {
    const { series, total } = buildGrowthSeries([], "day");
    expect(series).toEqual([]);
    expect(total).toBe(0);
  });
});

describe("GET /api/routes-f/follower-growth", () => {
  it("requires creator_id", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("creator_id");
  });

  it("rejects an invalid granularity", async () => {
    const res = await GET(makeReq("?creator_id=creator_a&granularity=hour"));
    expect(res.status).toBe(400);
  });

  it("defaults to day granularity", async () => {
    const res = await GET(makeReq("?creator_id=creator_a"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // creator_a has follows on 6 distinct days.
    expect(body.series.length).toBe(6);
  });

  it("returns the cumulative series and total", async () => {
    const res = await GET(makeReq("?creator_id=creator_a&granularity=month"));
    const body = await res.json();
    expect(body.total).toBe(9);
    expect(body.series[body.series.length - 1].count).toBe(9);
  });

  it("returns an empty series for an unknown creator", async () => {
    const res = await GET(makeReq("?creator_id=ghost"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.series).toEqual([]);
    expect(body.total).toBe(0);
  });
});
