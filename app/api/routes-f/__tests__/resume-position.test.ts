/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST, store } from "../resume-position/route";

function makePost(body: object) {
  return new NextRequest("http://localhost/api/routes-f/resume-position", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routes-f/resume-position");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

describe("Resume Position API", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  describe("POST /api/routes-f/resume-position", () => {
    it("returns 400 for missing fields", async () => {
      const res = await POST(makePost({}));
      expect(res.status).toBe(400);
    });

    it("saves a position", async () => {
      const res = await POST(makePost({ viewer_id: "v1", vod_id: "vod-1", position_seconds: 300, duration_seconds: 1200 }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.saved).toBe(true);
    });

    it("marks completed=false when below 95%", async () => {
      await POST(makePost({ viewer_id: "v1", vod_id: "vod-1", position_seconds: 940, duration_seconds: 1000 }));
      expect(store["v1:vod-1"].completed).toBe(false);
    });

    it("marks completed=true at exactly 95%", async () => {
      await POST(makePost({ viewer_id: "v1", vod_id: "vod-1", position_seconds: 950, duration_seconds: 1000 }));
      expect(store["v1:vod-1"].completed).toBe(true);
    });

    it("marks completed=true above 95%", async () => {
      await POST(makePost({ viewer_id: "v1", vod_id: "vod-1", position_seconds: 990, duration_seconds: 1000 }));
      expect(store["v1:vod-1"].completed).toBe(true);
    });

    it("overwrites a previous position", async () => {
      await POST(makePost({ viewer_id: "v1", vod_id: "vod-1", position_seconds: 300, duration_seconds: 1200 }));
      await POST(makePost({ viewer_id: "v1", vod_id: "vod-1", position_seconds: 600, duration_seconds: 1200 }));
      expect(store["v1:vod-1"].position_seconds).toBe(600);
    });
  });

  describe("GET /api/routes-f/resume-position", () => {
    it("returns 400 for missing params", async () => {
      const res = await GET(makeGet({}));
      expect(res.status).toBe(400);
    });

    it("returns default 0/false when no record exists", async () => {
      const res = await GET(makeGet({ viewer_id: "v-none", vod_id: "vod-x" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.position_seconds).toBe(0);
      expect(body.completed).toBe(false);
    });

    it("returns saved position and completed flag", async () => {
      await POST(makePost({ viewer_id: "v2", vod_id: "vod-2", position_seconds: 500, duration_seconds: 600 }));
      const res = await GET(makeGet({ viewer_id: "v2", vod_id: "vod-2" }));
      const body = await res.json();
      expect(body.position_seconds).toBe(500);
      expect(body.completed).toBe(false);
    });

    it("returns completed=true when position >= 95%", async () => {
      await POST(makePost({ viewer_id: "v3", vod_id: "vod-3", position_seconds: 1140, duration_seconds: 1200 }));
      const res = await GET(makeGet({ viewer_id: "v3", vod_id: "vod-3" }));
      const body = await res.json();
      expect(body.completed).toBe(true);
    });
  });
});
