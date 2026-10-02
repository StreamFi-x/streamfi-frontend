/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST, store } from "../playback-source/route";

function makePost(body: object) {
  return new NextRequest("http://localhost/api/routes-f/playback-source", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routes-f/playback-source");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

describe("Playback Source Selection API", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  describe("POST /api/routes-f/playback-source", () => {
    it("returns 400 for missing fields", async () => {
      const res = await POST(makePost({}));
      expect(res.status).toBe(400);
    });

    it("stores a quality selection", async () => {
      const res = await POST(makePost({ viewer_id: "v1", playback_id: "pb-1", quality_label: "720p" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.stored).toBe(true);
      expect(store["v1"].label).toBe("720p");
      expect(store["v1"].resolution).toBe("1280x720");
    });

    it("overwrites a previous selection", async () => {
      await POST(makePost({ viewer_id: "v1", playback_id: "pb-1", quality_label: "720p" }));
      await POST(makePost({ viewer_id: "v1", playback_id: "pb-2", quality_label: "1080p" }));
      expect(store["v1"].label).toBe("1080p");
      expect(store["v1"].resolution).toBe("1920x1080");
      expect(store["v1"].playback_id).toBe("pb-2");
    });
  });

  describe("GET /api/routes-f/playback-source", () => {
    it("returns 400 for missing viewer_id", async () => {
      const res = await GET(makeGet({}));
      expect(res.status).toBe(400);
    });

    it("returns null when no selection exists", async () => {
      const res = await GET(makeGet({ viewer_id: "v-unknown" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.last_quality).toBeNull();
    });

    it("returns the last stored quality", async () => {
      await POST(makePost({ viewer_id: "v2", playback_id: "pb-1", quality_label: "480p" }));
      const res = await GET(makeGet({ viewer_id: "v2" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.last_quality.label).toBe("480p");
      expect(body.last_quality.resolution).toBe("854x480");
    });

    it("retrieves overwritten quality correctly", async () => {
      await POST(makePost({ viewer_id: "v3", playback_id: "pb-1", quality_label: "360p" }));
      await POST(makePost({ viewer_id: "v3", playback_id: "pb-1", quality_label: "1080p" }));
      const res = await GET(makeGet({ viewer_id: "v3" }));
      const body = await res.json();
      expect(body.last_quality.label).toBe("1080p");
    });
  });
});
