import { GET, PUT, CLIP_COVERS } from "./route";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/routes-f/clip-cover-image";

function putReq(body: unknown) {
  return new NextRequest(BASE, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

describe("Clip Cover Image", () => {
  beforeEach(() => {
    for (const key in CLIP_COVERS) {
      delete CLIP_COVERS[key];
    }
  });

  describe("PUT /api/routes-f/clip-cover-image", () => {
    it("should set a custom cover for a clip", async () => {
      const res = await PUT(
        putReq({ clip_id: "clip-1", cover_url: "https://cdn.example.com/cover.png" })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.custom).toBe(true);
      expect(data.cover_url).toBe("https://cdn.example.com/cover.png");
      expect(CLIP_COVERS["clip-1"]).toBe("https://cdn.example.com/cover.png");
    });

    it("should overwrite an existing custom cover", async () => {
      await PUT(putReq({ clip_id: "clip-1", cover_url: "https://cdn.example.com/a.png" }));
      await PUT(putReq({ clip_id: "clip-1", cover_url: "https://cdn.example.com/b.png" }));

      expect(CLIP_COVERS["clip-1"]).toBe("https://cdn.example.com/b.png");
    });

    it("should return 400 for an invalid URL", async () => {
      const res = await PUT(putReq({ clip_id: "clip-1", cover_url: "not a url" }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("cover_url is not a valid URL");
      expect(CLIP_COVERS["clip-1"]).toBeUndefined();
    });

    it("should return 400 for a non-http(s) URL", async () => {
      const res = await PUT(
        putReq({ clip_id: "clip-1", cover_url: "ftp://example.com/cover.png" })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("cover_url must use http or https");
    });

    it("should return 400 when clip_id or cover_url is missing", async () => {
      const noClip = await PUT(putReq({ cover_url: "https://cdn.example.com/a.png" }));
      expect(noClip.status).toBe(400);

      const noUrl = await PUT(putReq({ clip_id: "clip-1" }));
      expect(noUrl.status).toBe(400);
    });

    it("should return 400 for invalid JSON", async () => {
      const req = new NextRequest(BASE, { method: "PUT", body: "not-json" });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/routes-f/clip-cover-image", () => {
    it("should return the custom cover when one is set", async () => {
      await PUT(
        putReq({ clip_id: "clip-1", cover_url: "https://cdn.example.com/cover.png" })
      );

      const res = await GET(new NextRequest(`${BASE}?clip_id=clip-1`));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.cover_url).toBe("https://cdn.example.com/cover.png");
      expect(data.custom).toBe(true);
    });

    it("should fall back to the auto thumbnail when no custom cover is set", async () => {
      const res = await GET(new NextRequest(`${BASE}?clip_id=clip-2`));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.custom).toBe(false);
      expect(data.cover_url).toBe("https://image.mux.com/clip-2/thumbnail.jpg");
    });

    it("should return 400 when clip_id is missing", async () => {
      const res = await GET(new NextRequest(BASE));
      expect(res.status).toBe(400);
    });
  });
});
