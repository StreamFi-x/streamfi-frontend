import { GET, SEED_HOURLY_VIEWS } from "./route";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/routes-f/clip-viewership-growth";

async function fetchGrowth(query = "") {
  const res = await GET(new NextRequest(`${BASE}${query}`));
  return { res, data: await res.json() };
}

describe("Clip Viewership Growth", () => {
  describe("GET /api/routes-f/clip-viewership-growth", () => {
    it("should return 400 when clip_id is missing", async () => {
      const { res } = await fetchGrowth();
      expect(res.status).toBe(400);
    });

    it("should return 404 for an unknown clip_id", async () => {
      const { res } = await fetchGrowth("?clip_id=does-not-exist");
      expect(res.status).toBe(404);
    });

    it("should return a series with the same length as the seed samples", async () => {
      const { res, data } = await fetchGrowth("?clip_id=clip-1");
      expect(res.status).toBe(200);
      expect(data.series).toHaveLength(SEED_HOURLY_VIEWS["clip-1"].length);
    });

    it("should compute correct cumulative views", async () => {
      const { data } = await fetchGrowth("?clip_id=clip-1");
      const cumulative = data.series.map((s: { views_cumulative: number }) => s.views_cumulative);
      expect(cumulative).toEqual([120, 200, 245, 275]);
    });

    it("should preserve the views_this_hour value per sample", async () => {
      const { data } = await fetchGrowth("?clip_id=clip-2");
      const perHour = data.series.map((s: { views_this_hour: number }) => s.views_this_hour);
      expect(perHour).toEqual([500, 320, 200, 150, 90]);
    });

    it("should return series sorted by hour_offset ascending", async () => {
      const { data } = await fetchGrowth("?clip_id=clip-2");
      const offsets = data.series.map((s: { hour_offset: number }) => s.hour_offset);
      expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    });
  });
});
