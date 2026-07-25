/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { computeConversion, isValidWindowDays } from "../utils";
import { getViewerEvents, getFollowEvents } from "../seedData";

function makeReq(creatorId?: string, windowDays?: number | string): NextRequest {
  let url = "http://localhost/api/routes-f/follower-conversion";
  const params: string[] = [];
  if (creatorId) params.push(`creator_id=${creatorId}`);
  if (windowDays !== undefined) params.push(`window_days=${windowDays}`);
  if (params.length) url += `?${params.join("&")}`;
  return new NextRequest(url);
}

describe("GET /api/routes-f/follower-conversion", () => {
  describe("Required Parameters", () => {
    it("returns 400 when creator_id is missing", async () => {
      const res = await GET(makeReq());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("creator_id");
    });

    it("returns 400 for a non-numeric window_days", async () => {
      const res = await GET(makeReq("creator_alpha", "abc"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("window_days");
    });

    it("returns 400 for a non-integer window_days", async () => {
      const res = await GET(makeReq("creator_alpha", "7.5"));
      expect(res.status).toBe(400);
    });

    it("returns 400 for window_days less than 1", async () => {
      const res = await GET(makeReq("creator_alpha", 0));
      expect(res.status).toBe(400);
    });
  });

  describe("Math with default 30-day window", () => {
    it("computes total_viewers, new_followers, and conversion_percent", async () => {
      const res = await GET(makeReq("creator_alpha"));
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.total_viewers).toBe(7);
      expect(body.new_followers).toBe(3);
      expect(body.conversion_percent).toBe(42.86);
    });

    it("does not count a follower who was never a viewer", async () => {
      // viewer_11 follows but never appears in viewerEventStore — verified
      // indirectly: new_followers stays at 3, not 4.
      const res = await GET(makeReq("creator_alpha"));
      const body = await res.json();
      expect(body.new_followers).toBe(3);
    });
  });

  describe("window_days filter", () => {
    it("produces different results for a narrower window", async () => {
      const res = await GET(makeReq("creator_alpha", 7));
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.total_viewers).toBe(3);
      expect(body.new_followers).toBe(2);
      expect(body.conversion_percent).toBe(66.67);
    });

    it("excludes events older than the window", async () => {
      const wide = await GET(makeReq("creator_alpha", 60));
      const narrow = await GET(makeReq("creator_alpha", 3));
      const wideBody = await wide.json();
      const narrowBody = await narrow.json();

      expect(wideBody.total_viewers).toBeGreaterThan(narrowBody.total_viewers);
    });
  });

  describe("Edge cases", () => {
    it("returns zero conversion when no one follows back", async () => {
      const res = await GET(makeReq("creator_beta"));
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.total_viewers).toBe(2);
      expect(body.new_followers).toBe(0);
      expect(body.conversion_percent).toBe(0);
    });

    it("returns zeros for an unknown creator_id", async () => {
      const res = await GET(makeReq("unknown_creator_xyz"));
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toEqual({
        total_viewers: 0,
        new_followers: 0,
        conversion_percent: 0,
      });
    });
  });

  describe("utils: computeConversion", () => {
    it("handles no viewers", () => {
      const result = computeConversion([], [], 30);
      expect(result).toEqual({
        total_viewers: 0,
        new_followers: 0,
        conversion_percent: 0,
      });
    });

    it("computes 100% conversion when every viewer follows", () => {
      const now = 1_000_000_000_000;
      const result = computeConversion(
        [
          { creator_id: "c", viewer: "a", timestamp: now },
          { creator_id: "c", viewer: "b", timestamp: now },
        ],
        [
          { creator_id: "c", viewer: "a", timestamp: now },
          { creator_id: "c", viewer: "b", timestamp: now },
        ],
        30,
        now
      );
      expect(result).toEqual({
        total_viewers: 2,
        new_followers: 2,
        conversion_percent: 100,
      });
    });
  });

  describe("utils: isValidWindowDays", () => {
    it("defaults to 30 when undefined", () => {
      expect(isValidWindowDays(undefined)).toEqual({ valid: true, value: 30 });
    });

    it("accepts a valid string integer", () => {
      expect(isValidWindowDays("14")).toEqual({ valid: true, value: 14 });
    });

    it("rejects negative values", () => {
      expect(isValidWindowDays(-5).valid).toBe(false);
    });
  });

  describe("seedData", () => {
    it("filters events by creator_id", () => {
      const events = getViewerEvents("creator_alpha");
      expect(events.every(e => e.creator_id === "creator_alpha")).toBe(true);
      expect(events.length).toBe(10);
    });

    it("returns empty arrays for unknown creator", () => {
      expect(getViewerEvents("nope")).toEqual([]);
      expect(getFollowEvents("nope")).toEqual([]);
    });
  });
});
