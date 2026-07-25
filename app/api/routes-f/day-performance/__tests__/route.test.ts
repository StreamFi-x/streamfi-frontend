/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { computeDayPerformance, getWeekdayName, WEEKDAY_ORDER } from "../utils";
import { getStreamsForCreator } from "../seedData";

function makeReq(creatorId?: string): NextRequest {
  const url = creatorId
    ? `http://localhost/api/routes-f/day-performance?creator_id=${creatorId}`
    : "http://localhost/api/routes-f/day-performance";
  return new NextRequest(url);
}

describe("GET /api/routes-f/day-performance", () => {
  describe("Required Parameters", () => {
    it("returns 400 when creator_id is missing", async () => {
      const res = await GET(makeReq());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("creator_id");
    });
  });

  describe("Aggregation", () => {
    it("returns all 7 days in Monday-first order", async () => {
      const res = await GET(makeReq("creator_delta"));
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.days).toHaveLength(7);
      expect(body.days.map((d: { day: string }) => d.day)).toEqual(
        WEEKDAY_ORDER
      );
    });

    it("computes avg_viewers, avg_tips_usdc, and stream_count per weekday", async () => {
      const res = await GET(makeReq("creator_delta"));
      const body = await res.json();

      const monday = body.days.find((d: { day: string }) => d.day === "Monday");
      // streams on 06-01 (100v/50t), 06-08 (200v/150t), 06-15 (300v/100t)
      expect(monday).toEqual({
        day: "Monday",
        avg_viewers: 200,
        avg_tips_usdc: 100,
        stream_count: 3,
      });

      const tuesday = body.days.find(
        (d: { day: string }) => d.day === "Tuesday"
      );
      // single stream on 06-02 (80v/20t)
      expect(tuesday).toEqual({
        day: "Tuesday",
        avg_viewers: 80,
        avg_tips_usdc: 20,
        stream_count: 1,
      });
    });

    it("zeroes out days with no streams", async () => {
      const res = await GET(makeReq("creator_delta"));
      const body = await res.json();

      const wednesday = body.days.find(
        (d: { day: string }) => d.day === "Wednesday"
      );
      expect(wednesday).toEqual({
        day: "Wednesday",
        avg_viewers: 0,
        avg_tips_usdc: 0,
        stream_count: 0,
      });
    });

    it("scopes results to the requested creator_id", async () => {
      const res = await GET(makeReq("creator_epsilon"));
      const body = await res.json();

      const tuesday = body.days.find(
        (d: { day: string }) => d.day === "Tuesday"
      );
      expect(tuesday).toEqual({
        day: "Tuesday",
        avg_viewers: 50,
        avg_tips_usdc: 10,
        stream_count: 1,
      });

      const monday = body.days.find((d: { day: string }) => d.day === "Monday");
      expect(monday.stream_count).toBe(0);
    });

    it("returns all-zero days for an unknown creator_id", async () => {
      const res = await GET(makeReq("unknown_creator_xyz"));
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.days).toHaveLength(7);
      for (const day of body.days) {
        expect(day.stream_count).toBe(0);
        expect(day.avg_viewers).toBe(0);
        expect(day.avg_tips_usdc).toBe(0);
      }
    });
  });

  describe("utils: getWeekdayName", () => {
    it("maps known ISO dates to the correct weekday", () => {
      expect(getWeekdayName("2026-06-01T00:00:00.000Z")).toBe("Monday");
      expect(getWeekdayName("2026-06-02T00:00:00.000Z")).toBe("Tuesday");
    });
  });

  describe("utils: computeDayPerformance", () => {
    it("handles an empty stream list", () => {
      const days = computeDayPerformance([]);
      expect(days).toHaveLength(7);
      expect(days.every(d => d.stream_count === 0)).toBe(true);
    });

    it("rounds averages to two decimal places", () => {
      const days = computeDayPerformance([
        {
          id: "a",
          creator_id: "c",
          date: "2026-06-01T00:00:00.000Z",
          viewer_count: 10,
          tips_usdc: 10,
        },
        {
          id: "b",
          creator_id: "c",
          date: "2026-06-08T00:00:00.000Z",
          viewer_count: 11,
          tips_usdc: 5,
        },
        {
          id: "c",
          creator_id: "c",
          date: "2026-06-15T00:00:00.000Z",
          viewer_count: 12,
          tips_usdc: 3,
        },
      ]);
      const monday = days.find(d => d.day === "Monday")!;
      expect(monday.avg_viewers).toBe(11);
      expect(monday.avg_tips_usdc).toBe(6);
      expect(monday.stream_count).toBe(3);
    });
  });

  describe("seedData", () => {
    it("filters streams by creator_id", () => {
      const streams = getStreamsForCreator("creator_delta");
      expect(streams.every(s => s.creator_id === "creator_delta")).toBe(true);
      expect(streams.length).toBe(4);
    });

    it("returns empty array for unknown creator", () => {
      expect(getStreamsForCreator("nope")).toEqual([]);
    });
  });
});
