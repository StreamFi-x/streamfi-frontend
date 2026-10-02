/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { computeReturningStats } from "../utils";
import { getHistoryForStream, viewerHistoryStore } from "../seedData";

function makeReq(streamId?: string): NextRequest {
  const url = streamId
    ? `http://localhost/api/routes-f/returning-viewers?stream_id=${streamId}`
    : "http://localhost/api/routes-f/returning-viewers";
  return new NextRequest(url);
}

describe("GET /api/routes-f/returning-viewers", () => {
  describe("Required Parameters", () => {
    it("returns 400 when stream_id is missing", async () => {
      const res = await GET(makeReq());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("stream_id");
    });
  });

  describe("Aggregation math", () => {
    it("computes returning_count, avg_prior_visits, and top_returning for a mixed stream", async () => {
      const res = await GET(makeReq("stream_alpha_1"));
      expect(res.status).toBe(200);
      const body = await res.json();

      // returning viewers: a(5) b(3) d(8) f(1) -> 4 returning, avg = 17/4 = 4.25
      expect(body.returning_count).toBe(4);
      expect(body.avg_prior_visits).toBe(4.25);
      expect(body.top_returning).toEqual([
        { viewer: "viewer_d", prior_visits: 8 },
        { viewer: "viewer_a", prior_visits: 5 },
        { viewer: "viewer_b", prior_visits: 3 },
        { viewer: "viewer_f", prior_visits: 1 },
      ]);
    });

    it("caps top_returning at 5 entries, sorted descending", async () => {
      const res = await GET(makeReq("stream_gamma_3"));
      const body = await res.json();

      // 7 returning viewers seeded, only top 5 should be returned
      expect(body.returning_count).toBe(7);
      expect(body.top_returning).toHaveLength(5);
      expect(body.top_returning).toEqual([
        { viewer: "viewer_m", prior_visits: 20 },
        { viewer: "viewer_o", prior_visits: 15 },
        { viewer: "viewer_j", prior_visits: 12 },
        { viewer: "viewer_p", prior_visits: 9 },
        { viewer: "viewer_l", prior_visits: 7 },
      ]);

      const avg = Math.round(((12 + 2 + 7 + 20 + 1 + 15 + 9) / 7) * 100) / 100;
      expect(body.avg_prior_visits).toBe(avg);
    });

    it("returns zeros when no viewers are returning", async () => {
      const res = await GET(makeReq("stream_beta_2"));
      const body = await res.json();

      expect(body.returning_count).toBe(0);
      expect(body.avg_prior_visits).toBe(0);
      expect(body.top_returning).toEqual([]);
    });

    it("returns zeros for an unknown stream_id", async () => {
      const res = await GET(makeReq("unknown_stream_xyz"));
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.returning_count).toBe(0);
      expect(body.avg_prior_visits).toBe(0);
      expect(body.top_returning).toEqual([]);
    });
  });

  describe("utils: computeReturningStats", () => {
    it("excludes zero-visit viewers from returning_count", () => {
      const stats = computeReturningStats([
        { stream_id: "s", viewer: "x", prior_visits: 0 },
        { stream_id: "s", viewer: "y", prior_visits: 2 },
      ]);
      expect(stats.returning_count).toBe(1);
      expect(stats.avg_prior_visits).toBe(2);
    });

    it("handles an empty record set", () => {
      expect(computeReturningStats([])).toEqual({
        returning_count: 0,
        avg_prior_visits: 0,
        top_returning: [],
      });
    });
  });

  describe("seedData", () => {
    it("filters records by stream_id", () => {
      const records = getHistoryForStream("stream_alpha_1");
      expect(records.every(r => r.stream_id === "stream_alpha_1")).toBe(true);
      expect(records.length).toBe(6);
    });

    it("returns empty array for unknown stream", () => {
      expect(getHistoryForStream("nope")).toEqual([]);
    });

    it("has seed data loaded", () => {
      expect(viewerHistoryStore.length).toBeGreaterThan(0);
    });
  });
});
