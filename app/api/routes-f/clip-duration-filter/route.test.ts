import { GET, SEED_CLIPS } from "./route";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/routes-f/clip-duration-filter";

async function fetchClips(query = "") {
  const res = await GET(new NextRequest(`${BASE}${query}`));
  return { res, data: await res.json() };
}

describe("Clip Duration Filter", () => {
  describe("GET /api/routes-f/clip-duration-filter", () => {
    it("should return all seed clips sorted by duration asc when no filters given", async () => {
      const { res, data } = await fetchClips();

      expect(res.status).toBe(200);
      expect(data.clips).toHaveLength(SEED_CLIPS.length);
      const durations = data.clips.map((c: { duration_seconds: number }) => c.duration_seconds);
      expect(durations).toEqual([...durations].sort((a, b) => a - b));
    });

    it("should filter by min_seconds (inclusive)", async () => {
      const { data } = await fetchClips("?min_seconds=95");
      const durations = data.clips.map((c: { duration_seconds: number }) => c.duration_seconds);
      expect(durations).toEqual([95, 180, 240]);
    });

    it("should filter by max_seconds (inclusive)", async () => {
      const { data } = await fetchClips("?max_seconds=15");
      const durations = data.clips.map((c: { duration_seconds: number }) => c.duration_seconds);
      expect(durations).toEqual([8, 12, 15]);
    });

    it("should filter by a min/max window combined", async () => {
      const { data } = await fetchClips("?min_seconds=15&max_seconds=95");
      const durations = data.clips.map((c: { duration_seconds: number }) => c.duration_seconds);
      expect(durations).toEqual([15, 30, 45, 95]);
    });

    it("should filter by creator_id", async () => {
      const { data } = await fetchClips("?creator_id=creator-2");
      expect(data.clips).toHaveLength(3);
      for (const clip of data.clips) {
        expect(clip.creator_id).toBe("creator-2");
      }
    });

    it("should combine creator_id with a duration window", async () => {
      const { data } = await fetchClips("?creator_id=creator-1&max_seconds=50");
      const ids = data.clips.map((c: { clip_id: string }) => c.clip_id);
      expect(ids).toEqual(["clip-1", "clip-2"]);
    });

    it("should respect the limit parameter", async () => {
      const { data } = await fetchClips("?limit=2");
      expect(data.clips).toHaveLength(2);
      const durations = data.clips.map((c: { duration_seconds: number }) => c.duration_seconds);
      expect(durations).toEqual([8, 12]);
    });

    it("should return an empty list when the window matches nothing", async () => {
      const { res, data } = await fetchClips("?min_seconds=1000");
      expect(res.status).toBe(200);
      expect(data.clips).toEqual([]);
      expect(data.total).toBe(0);
    });

    it("should return 400 when min_seconds is greater than max_seconds", async () => {
      const { res } = await fetchClips("?min_seconds=100&max_seconds=10");
      expect(res.status).toBe(400);
    });

    it("should return 400 for non-numeric or negative bounds", async () => {
      expect((await fetchClips("?min_seconds=abc")).res.status).toBe(400);
      expect((await fetchClips("?max_seconds=-5")).res.status).toBe(400);
    });

    it("should return 400 for an invalid limit", async () => {
      expect((await fetchClips("?limit=0")).res.status).toBe(400);
      expect((await fetchClips("?limit=abc")).res.status).toBe(400);
      expect((await fetchClips("?limit=101")).res.status).toBe(400);
    });
  });
});
