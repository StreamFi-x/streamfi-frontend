import { GET, POST, featuredMomentsStore } from "./route";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/routesF/featured-vod-moment";

function postMoment(body: unknown) {
  return POST(
    new NextRequest(BASE, {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

function getMoments(query: string) {
  return GET(new NextRequest(`${BASE}${query}`));
}

describe("Featured VOD Moment", () => {
  beforeEach(() => {
    featuredMomentsStore.clear();
  });

  describe("POST /api/routesF/featured-vod-moment", () => {
    it("should return 400 when vod_id is missing", async () => {
      const res = await postMoment({ start_seconds: 0, end_seconds: 10, title: "x" });
      expect(res.status).toBe(400);
    });

    it("should return 400 when end_seconds is not after start_seconds", async () => {
      const res = await postMoment({
        vod_id: "vod-1",
        start_seconds: 30,
        end_seconds: 10,
        title: "Bad clip",
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 when title is missing", async () => {
      const res = await postMoment({ vod_id: "vod-1", start_seconds: 0, end_seconds: 10 });
      expect(res.status).toBe(400);
    });

    it("should create a featured moment and return a featured_id", async () => {
      const res = await postMoment({
        vod_id: "vod-1",
        start_seconds: 120,
        end_seconds: 180,
        title: "Best play of the stream",
      });
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(typeof data.featured_id).toBe("string");
    });

    it("should cap featured moments at 3 per VOD", async () => {
      for (let i = 0; i < 3; i++) {
        const res = await postMoment({
          vod_id: "vod-cap",
          start_seconds: i * 10,
          end_seconds: i * 10 + 5,
          title: `Moment ${i}`,
        });
        expect(res.status).toBe(201);
      }

      const fourth = await postMoment({
        vod_id: "vod-cap",
        start_seconds: 40,
        end_seconds: 45,
        title: "One too many",
      });
      expect(fourth.status).toBe(409);
    });
  });

  describe("GET /api/routesF/featured-vod-moment", () => {
    it("should return 400 when vod_id is missing", async () => {
      const res = await getMoments("");
      expect(res.status).toBe(400);
    });

    it("should return an empty list for a VOD with no featured moments", async () => {
      const res = await getMoments("?vod_id=vod-empty");
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.moments).toEqual([]);
    });

    it("should list previously created featured moments for a VOD", async () => {
      await postMoment({
        vod_id: "vod-2",
        start_seconds: 5,
        end_seconds: 15,
        title: "First highlight",
      });
      await postMoment({
        vod_id: "vod-2",
        start_seconds: 100,
        end_seconds: 110,
        title: "Second highlight",
      });

      const res = await getMoments("?vod_id=vod-2");
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.moments).toHaveLength(2);
      expect(data.moments[0].title).toBe("First highlight");
      expect(data.moments[1].title).toBe("Second highlight");
    });

    it("should not mix moments across different VODs", async () => {
      await postMoment({ vod_id: "vod-a", start_seconds: 0, end_seconds: 5, title: "A moment" });
      await postMoment({ vod_id: "vod-b", start_seconds: 0, end_seconds: 5, title: "B moment" });

      const resA = await getMoments("?vod_id=vod-a");
      const dataA = await resA.json();
      expect(dataA.moments).toHaveLength(1);
      expect(dataA.moments[0].title).toBe("A moment");
    });
  });
});
