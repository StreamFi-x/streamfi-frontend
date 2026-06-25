import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "../route";
import { POST as REORDER_POST } from "../reorder/route";
import { clearAllPlaylists } from "../store";

function makeGetReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/routes-f/vod-playlist");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

function makePostReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/vod-playlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/vod-playlist", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeReorderReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/vod-playlist/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("vod-playlist lifecycle", () => {
  beforeEach(() => {
    clearAllPlaylists();
  });

  describe("POST /api/routes-f/vod-playlist", () => {
    it("appends a VOD to the playlist", async () => {
      const res = await POST(
        makePostReq({ viewer_id: "v1", vod_id: "vod_1" })
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.vod_id).toBe("vod_1");
      expect(typeof data.added_at).toBe("string");
    });

    it("returns 400 when viewer_id is missing", async () => {
      const res = await POST(makePostReq({ vod_id: "vod_1" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when vod_id is missing", async () => {
      const res = await POST(makePostReq({ viewer_id: "v1" }));
      expect(res.status).toBe(400);
    });

    it("returns 409 when VOD already in playlist", async () => {
      await POST(makePostReq({ viewer_id: "v1", vod_id: "vod_1" }));
      const res = await POST(
        makePostReq({ viewer_id: "v1", vod_id: "vod_1" })
      );
      expect(res.status).toBe(409);
    });

    it("returns 400 when playlist is full (100 items)", async () => {
      for (let i = 0; i < 100; i++) {
        await POST(makePostReq({ viewer_id: "v_full", vod_id: `vod_${i}` }));
      }
      const res = await POST(
        makePostReq({ viewer_id: "v_full", vod_id: "vod_100" })
      );
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/routes-f/vod-playlist", () => {
    it("returns 400 when viewer_id is missing", async () => {
      const res = await GET(makeGetReq({}));
      expect(res.status).toBe(400);
    });

    it("returns empty playlist for unknown viewer", async () => {
      const res = await GET(makeGetReq({ viewer_id: "unknown" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items).toEqual([]);
    });

    it("returns playlist with items", async () => {
      await POST(makePostReq({ viewer_id: "v1", vod_id: "vod_1" }));
      await POST(makePostReq({ viewer_id: "v1", vod_id: "vod_2" }));
      const res = await GET(makeGetReq({ viewer_id: "v1" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items).toHaveLength(2);
      expect(data.viewer_id).toBe("v1");
    });
  });

  describe("DELETE /api/routes-f/vod-playlist", () => {
    it("removes a VOD from the playlist", async () => {
      await POST(makePostReq({ viewer_id: "v1", vod_id: "vod_1" }));
      const res = await DELETE(
        makeDeleteReq({ viewer_id: "v1", vod_id: "vod_1" })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.removed).toBe(true);
    });

    it("returns 404 when VOD not in playlist", async () => {
      const res = await DELETE(
        makeDeleteReq({ viewer_id: "v1", vod_id: "vod_none" })
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 when viewer_id is missing", async () => {
      const res = await DELETE(makeDeleteReq({ vod_id: "vod_1" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when vod_id is missing", async () => {
      const res = await DELETE(makeDeleteReq({ viewer_id: "v1" }));
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/routes-f/vod-playlist/reorder", () => {
    it("reorders the playlist", async () => {
      await POST(makePostReq({ viewer_id: "v1", vod_id: "vod_a" }));
      await POST(makePostReq({ viewer_id: "v1", vod_id: "vod_b" }));
      await POST(makePostReq({ viewer_id: "v1", vod_id: "vod_c" }));

      const res = await REORDER_POST(
        makeReorderReq({ viewer_id: "v1", order: ["vod_c", "vod_a", "vod_b"] })
      );
      expect(res.status).toBe(200);

      const playlist = await GET(makeGetReq({ viewer_id: "v1" }));
      const data = await playlist.json();
      expect(data.items.map((i: { vod_id: string }) => i.vod_id)).toEqual([
        "vod_c",
        "vod_a",
        "vod_b",
      ]);
    });

    it("returns 400 when order is not an array", async () => {
      const res = await REORDER_POST(
        makeReorderReq({ viewer_id: "v1", order: "not_array" })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when order is empty", async () => {
      const res = await REORDER_POST(
        makeReorderReq({ viewer_id: "v1", order: [] })
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 when viewer has no playlist", async () => {
      const res = await REORDER_POST(
        makeReorderReq({ viewer_id: "unknown", order: ["vod_x"] })
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 when order contains unknown vod_id", async () => {
      await POST(makePostReq({ viewer_id: "v1", vod_id: "vod_a" }));
      const res = await REORDER_POST(
        makeReorderReq({ viewer_id: "v1", order: ["vod_a", "vod_z"] })
      );
      expect(res.status).toBe(400);
    });
  });
});
