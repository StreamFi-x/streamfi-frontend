import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { clearAllCovers } from "../store";

function makeGetReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/routes-f/stream-cover");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

function makePostReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/stream-cover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("stream-cover lifecycle", () => {
  beforeEach(() => {
    clearAllCovers();
  });

  describe("POST /api/routes-f/stream-cover", () => {
    it("sets a cover image and returns updated_at", async () => {
      const res = await POST(
        makePostReq({
          stream_id: "s1",
          cover_url: "https://example.com/cover.jpg",
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data.updated_at).toBe("string");
    });

    it("overwrites an existing cover image", async () => {
      await POST(
        makePostReq({
          stream_id: "s1",
          cover_url: "https://example.com/cover1.jpg",
        })
      );
      const res = await POST(
        makePostReq({
          stream_id: "s1",
          cover_url: "https://example.com/cover2.jpg",
        })
      );
      expect(res.status).toBe(200);

      const getRes = await GET(makeGetReq({ stream_id: "s1" }));
      const data = await getRes.json();
      expect(data.cover_url).toBe("https://example.com/cover2.jpg");
    });

    it("returns 400 when stream_id is missing", async () => {
      const res = await POST(
        makePostReq({ cover_url: "https://example.com/cover.jpg" })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when cover_url is missing", async () => {
      const res = await POST(makePostReq({ stream_id: "s1" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid URL", async () => {
      const res = await POST(
        makePostReq({ stream_id: "s1", cover_url: "not-a-url" })
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/valid URL/i);
    });

    it("accepts http URLs", async () => {
      const res = await POST(
        makePostReq({
          stream_id: "s1",
          cover_url: "http://example.com/cover.jpg",
        })
      );
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/routes-f/stream-cover", () => {
    it("returns 400 when stream_id is missing", async () => {
      const res = await GET(makeGetReq({}));
      expect(res.status).toBe(400);
    });

    it("returns 404 when no cover is set", async () => {
      const res = await GET(makeGetReq({ stream_id: "s_unknown" }));
      expect(res.status).toBe(404);
    });

    it("returns the cover image after setting it", async () => {
      await POST(
        makePostReq({
          stream_id: "s1",
          cover_url: "https://example.com/cover.jpg",
        })
      );
      const res = await GET(makeGetReq({ stream_id: "s1" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.stream_id).toBe("s1");
      expect(data.cover_url).toBe("https://example.com/cover.jpg");
      expect(typeof data.updated_at).toBe("string");
    });
  });
});
