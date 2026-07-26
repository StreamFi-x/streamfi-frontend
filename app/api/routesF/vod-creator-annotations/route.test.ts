import { NextRequest } from "next/server";
import { POST, GET, DELETE } from "./route";

function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/vod-creator-annotations", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routesF/vod-creator-annotations");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

function makeDelete(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/vod-creator-annotations", {
    method: "DELETE",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("VOD Creator Annotations API", () => {
  describe("POST", () => {
    it("creates an annotation and returns annotation_id", async () => {
      const res = await POST(makePost({ vod_id: "vod-1", time_seconds: 120, text: "Epic moment!" }));
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(typeof data.annotation_id).toBe("string");
      expect(data.annotation_id.length).toBeGreaterThan(0);
    });

    it("returns 400 when vod_id is missing", async () => {
      const res = await POST(makePost({ time_seconds: 30, text: "hello" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when time_seconds is missing", async () => {
      const res = await POST(makePost({ vod_id: "vod-1", text: "hello" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when text is empty", async () => {
      const res = await POST(makePost({ vod_id: "vod-1", time_seconds: 10, text: "" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for negative time_seconds", async () => {
      const res = await POST(makePost({ vod_id: "vod-1", time_seconds: -5, text: "oops" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON", async () => {
      const req = new NextRequest("http://localhost/api/routesF/vod-creator-annotations", {
        method: "POST",
        body: "bad",
        headers: { "Content-Type": "application/json" },
      });
      expect((await POST(req)).status).toBe(400);
    });
  });

  describe("GET", () => {
    it("returns annotations for a vod sorted by time_seconds", async () => {
      const vodId = "vod-sort-test";
      await POST(makePost({ vod_id: vodId, time_seconds: 300, text: "Third" }));
      await POST(makePost({ vod_id: vodId, time_seconds: 10, text: "First" }));
      await POST(makePost({ vod_id: vodId, time_seconds: 150, text: "Second" }));

      const res = await GET(makeGet({ vod_id: vodId }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.vod_id).toBe(vodId);
      expect(data.annotations.length).toBeGreaterThanOrEqual(3);

      const times = data.annotations.map((a: { time_seconds: number }) => a.time_seconds);
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
      }
    });

    it("returns empty list for vod with no annotations", async () => {
      const res = await GET(makeGet({ vod_id: "vod-empty-999" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.annotations).toHaveLength(0);
      expect(data.total).toBe(0);
    });

    it("returns 400 when vod_id is missing", async () => {
      const res = await GET(makeGet({}));
      expect(res.status).toBe(400);
    });

    it("each annotation has required fields", async () => {
      const vodId = "vod-fields";
      await POST(makePost({ vod_id: vodId, time_seconds: 60, text: "Check fields" }));

      const res = await GET(makeGet({ vod_id: vodId }));
      const { annotations } = await res.json();

      for (const ann of annotations) {
        expect(ann).toHaveProperty("annotation_id");
        expect(ann).toHaveProperty("vod_id");
        expect(ann).toHaveProperty("time_seconds");
        expect(ann).toHaveProperty("text");
        expect(ann).toHaveProperty("created_at");
      }
    });
  });

  describe("DELETE", () => {
    it("deletes an annotation by annotation_id", async () => {
      const postRes = await POST(makePost({ vod_id: "vod-del", time_seconds: 45, text: "Delete me" }));
      const { annotation_id } = await postRes.json();

      const delRes = await DELETE(makeDelete({ annotation_id }));
      const delData = await delRes.json();

      expect(delRes.status).toBe(200);
      expect(delData.deleted).toBe(true);
      expect(delData.annotation_id).toBe(annotation_id);
    });

    it("deleted annotation no longer appears in GET", async () => {
      const vodId = "vod-del-verify";
      const postRes = await POST(makePost({ vod_id: vodId, time_seconds: 90, text: "Going away" }));
      const { annotation_id } = await postRes.json();

      await DELETE(makeDelete({ annotation_id }));

      const getRes = await GET(makeGet({ vod_id: vodId }));
      const { annotations } = await getRes.json();

      const found = annotations.find((a: { annotation_id: string }) => a.annotation_id === annotation_id);
      expect(found).toBeUndefined();
    });

    it("returns 404 for non-existent annotation_id", async () => {
      const res = await DELETE(makeDelete({ annotation_id: "ann-does-not-exist" }));
      expect(res.status).toBe(404);
    });

    it("returns 400 when annotation_id is missing", async () => {
      const res = await DELETE(makeDelete({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON", async () => {
      const req = new NextRequest("http://localhost/api/routesF/vod-creator-annotations", {
        method: "DELETE",
        body: "bad",
        headers: { "Content-Type": "application/json" },
      });
      expect((await DELETE(req)).status).toBe(400);
    });
  });
});
