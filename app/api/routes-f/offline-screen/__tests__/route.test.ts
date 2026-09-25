/**
 * Tests for app/api/routes-f/offline-screen/
 * Covers: GET config, POST set config, validation
 */

import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { offlineScreenStore } from "../store";

function makeGetReq(creator_id: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/offline-screen?creator_id=${creator_id}`
  );
}

function makePostReq(body: unknown) {
  return new NextRequest(`http://localhost/api/routes-f/offline-screen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  delete offlineScreenStore["creator_new"];
});

describe("GET /api/routes-f/offline-screen", () => {
  it("returns 400 when creator_id is missing", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/offline-screen");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown creator", async () => {
    const res = await GET(makeGetReq("creator_unknown_xyz"));
    expect(res.status).toBe(404);
  });

  it("returns config for known creator", async () => {
    const res = await GET(makeGetReq("creator_alice"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.type).toBe("image");
    expect(body.source_url).toBeDefined();
  });
});

describe("POST /api/routes-f/offline-screen", () => {
  it("sets an image offline screen", async () => {
    const res = await POST(
      makePostReq({
        creator_id: "creator_new",
        type: "image",
        source_url: "https://cdn.example.com/banner.png",
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.type).toBe("image");
    expect(body.source_url).toBe("https://cdn.example.com/banner.png");
  });

  it("sets a vod offline screen", async () => {
    const res = await POST(
      makePostReq({ creator_id: "creator_new", type: "vod", vod_id: "vod_abc" })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.type).toBe("vod");
    expect(body.vod_id).toBe("vod_abc");
  });

  it("returns 400 when image type lacks source_url", async () => {
    const res = await POST(
      makePostReq({ creator_id: "creator_new", type: "image" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when vod type lacks vod_id", async () => {
    const res = await POST(
      makePostReq({ creator_id: "creator_new", type: "vod" })
    );
    expect(res.status).toBe(400);
  });

  it("sets type none without extra fields", async () => {
    const res = await POST(
      makePostReq({ creator_id: "creator_new", type: "none" })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.type).toBe("none");
  });
});
