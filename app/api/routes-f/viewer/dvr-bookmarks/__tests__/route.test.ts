import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "../route";
import { clearAllBookmarks } from "../store";

function makeGetReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/routes-f/viewer/dvr-bookmarks");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

function makePostReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/viewer/dvr-bookmarks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/viewer/dvr-bookmarks", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("viewer/dvr-bookmarks", () => {
  beforeEach(() => {
    clearAllBookmarks();
  });

  describe("POST", () => {
    it("creates a bookmark and returns bookmark_id", async () => {
      const res = await POST(
        makePostReq({
          viewer_id: "viewer_1",
          stream_id: "stream_live_abc",
          time_seconds: 342,
          label: "Epic play",
        })
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.bookmark_id).toMatch(/^bmk_/);
    });

    it("creates a bookmark without optional label", async () => {
      const res = await POST(
        makePostReq({
          viewer_id: "viewer_1",
          stream_id: "stream_live_abc",
          time_seconds: 120,
        })
      );
      expect(res.status).toBe(201);
    });

    it("returns 400 when required fields are missing", async () => {
      const res = await POST(makePostReq({ viewer_id: "viewer_1" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for negative time_seconds", async () => {
      const res = await POST(
        makePostReq({
          viewer_id: "viewer_1",
          stream_id: "stream_live_abc",
          time_seconds: -1,
        })
      );
      expect(res.status).toBe(400);
    });
  });

  describe("GET", () => {
    it("returns 400 when viewer_id is missing", async () => {
      const res = await GET(makeGetReq({}));
      expect(res.status).toBe(400);
    });

    it("returns recent bookmarks for a viewer", async () => {
      await POST(
        makePostReq({
          viewer_id: "viewer_1",
          stream_id: "stream_a",
          time_seconds: 100,
        })
      );
      await POST(
        makePostReq({
          viewer_id: "viewer_1",
          stream_id: "stream_b",
          time_seconds: 200,
          label: "Second moment",
        })
      );
      await POST(
        makePostReq({
          viewer_id: "viewer_2",
          stream_id: "stream_a",
          time_seconds: 50,
        })
      );

      const res = await GET(makeGetReq({ viewer_id: "viewer_1" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.bookmarks).toHaveLength(2);
      expect(data.bookmarks.every((b: { viewer_id: string }) => b.viewer_id === "viewer_1")).toBe(true);
    });

    it("returns empty list for unknown viewer", async () => {
      const res = await GET(makeGetReq({ viewer_id: "unknown" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.bookmarks).toEqual([]);
    });
  });

  describe("DELETE", () => {
    it("removes a bookmark", async () => {
      const createRes = await POST(
        makePostReq({
          viewer_id: "viewer_1",
          stream_id: "stream_a",
          time_seconds: 100,
        })
      );
      const { bookmark_id } = await createRes.json();

      const res = await DELETE(
        makeDeleteReq({ viewer_id: "viewer_1", bookmark_id })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.removed).toBe(true);

      const listRes = await GET(makeGetReq({ viewer_id: "viewer_1" }));
      const list = await listRes.json();
      expect(list.bookmarks).toHaveLength(0);
    });

    it("returns 404 when bookmark not found", async () => {
      const res = await DELETE(
        makeDeleteReq({ viewer_id: "viewer_1", bookmark_id: "bmk_missing" })
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 when fields are missing", async () => {
      const res = await DELETE(makeDeleteReq({ viewer_id: "viewer_1" }));
      expect(res.status).toBe(400);
    });
  });
});
