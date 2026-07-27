import { NextRequest } from "next/server";
import { POST } from "../route";

function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/frame-grab", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/routes-f/frame-grab", () => {
  it("returns a frame_url for a valid request", async () => {
    const res = await POST(
      makePost({ clip_id: "clip-001", playback_id: "mux-abc123", time_seconds: 30 }),
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.frame_url).toBe("string");
    expect(data.frame_url).toContain("mux-abc123");
    expect(data.frame_url).toContain("time=30");
  });

  it("frame_url uses the Mux thumbnail format", async () => {
    const res = await POST(
      makePost({ clip_id: "clip-002", playback_id: "pb-xyz", time_seconds: 0 }),
    );
    const data = await res.json();
    expect(data.frame_url).toMatch(
      /^https:\/\/image\.mux\.com\/pb-xyz\/thumbnail\.jpg\?time=0$/,
    );
  });

  it("returns 400 when clip_id is missing", async () => {
    const res = await POST(makePost({ playback_id: "pb-xyz", time_seconds: 10 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when playback_id is missing", async () => {
    const res = await POST(makePost({ clip_id: "clip-001", time_seconds: 10 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when time_seconds is missing", async () => {
    const res = await POST(makePost({ clip_id: "clip-001", playback_id: "pb-xyz" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a negative time_seconds", async () => {
    const res = await POST(
      makePost({ clip_id: "clip-001", playback_id: "pb-xyz", time_seconds: -5 }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 422 when time_seconds exceeds clip duration", async () => {
    const res = await POST(
      makePost({ clip_id: "clip-001", playback_id: "pb-xyz", time_seconds: 9999 }),
    );
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(typeof data.clip_duration_seconds).toBe("number");
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/frame-grab", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
