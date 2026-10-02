import { NextRequest } from "next/server";
import { POST, GET } from "../route";

function makeGetReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/routes-f/vod/comment");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

function makePostReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/vod/comment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/vod/comment", () => {
  it("creates a comment and returns comment_id + created_at", async () => {
    const res = await POST(
      makePostReq({ vod_id: "vod_a1", time_seconds: 500, user_id: "viewer_x", text: "Great moment!" })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(typeof data.comment_id).toBe("string");
    expect(typeof data.created_at).toBe("string");
  });

  it("returns 400 when vod_id is missing", async () => {
    const res = await POST(
      makePostReq({ time_seconds: 10, user_id: "u1", text: "hi" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when user_id is missing", async () => {
    const res = await POST(
      makePostReq({ vod_id: "vod_a1", time_seconds: 10, text: "hi" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when text is empty string", async () => {
    const res = await POST(
      makePostReq({ vod_id: "vod_a1", time_seconds: 10, user_id: "u1", text: "" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown vod_id", async () => {
    const res = await POST(
      makePostReq({ vod_id: "vod_zzz", time_seconds: 10, user_id: "u1", text: "test" })
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when time_seconds exceeds vod duration", async () => {
    // vod_a1 duration is 7200s
    const res = await POST(
      makePostReq({ vod_id: "vod_a1", time_seconds: 9999, user_id: "u1", text: "too far" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/duration/i);
  });

  it("returns 400 for negative time_seconds", async () => {
    const res = await POST(
      makePostReq({ vod_id: "vod_a1", time_seconds: -1, user_id: "u1", text: "nope" })
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/routes-f/vod/comment", () => {
  it("returns 400 when vod_id is missing", async () => {
    const res = await GET(makeGetReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown vod_id", async () => {
    const res = await GET(makeGetReq({ vod_id: "vod_zzz" }));
    expect(res.status).toBe(404);
  });

  it("returns comments for a vod", async () => {
    const res = await GET(makeGetReq({ vod_id: "vod_a1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.comments)).toBe(true);
    expect(typeof data.total).toBe("number");
    expect(data.total).toBeGreaterThan(0); // seed data exists
  });

  it("near_time filter returns only comments within default 30s radius", async () => {
    // Seed has comment at 120s and 125s, and one at 300s
    const res = await GET(makeGetReq({ vod_id: "vod_a1", near_time: "120" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const c of data.comments) {
      expect(Math.abs(c.time_seconds - 120)).toBeLessThanOrEqual(30);
    }
  });

  it("near_time with custom radius filters correctly", async () => {
    const res = await GET(
      makeGetReq({ vod_id: "vod_a1", near_time: "120", radius_seconds: "5" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const c of data.comments) {
      expect(Math.abs(c.time_seconds - 120)).toBeLessThanOrEqual(5);
    }
  });

  it("returns 400 for invalid near_time", async () => {
    const res = await GET(makeGetReq({ vod_id: "vod_a1", near_time: "abc" }));
    expect(res.status).toBe(400);
  });
});
