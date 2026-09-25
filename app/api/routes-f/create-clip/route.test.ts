import { POST, CREATED_CLIPS } from "./route";
import { NextRequest } from "next/server";

describe("POST /api/routes-f/create-clip", () => {
  beforeEach(() => {
    // Clear the in-memory array before each test
    CREATED_CLIPS.length = 0;
  });

  it("should create a clip successfully with valid payload", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/create-clip", {
      method: "POST",
      body: JSON.stringify({
        stream_id: "stream-123",
        playback_id: "playback-456",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data.clip_id).toBeDefined();
    expect(data.clip_id).toMatch(/^clip_/);
    expect(data.mux_url_pattern).toContain("playback-456.m3u8");
    expect(data.mux_url_pattern).toContain("duration=30"); // default

    expect(CREATED_CLIPS.length).toBe(1);
    expect(CREATED_CLIPS[0].clip_id).toBe(data.clip_id);
    expect(CREATED_CLIPS[0].duration_seconds).toBe(30);
    expect(CREATED_CLIPS[0].title).toBe("Untitled Clip");
  });

  it("should validate duration boundaries (too short)", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/create-clip", {
      method: "POST",
      body: JSON.stringify({
        stream_id: "stream-123",
        playback_id: "playback-456",
        duration_seconds: 4,
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("duration_seconds must be between 5 and 90");
    expect(CREATED_CLIPS.length).toBe(0);
  });

  it("should validate duration boundaries (too long)", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/create-clip", {
      method: "POST",
      body: JSON.stringify({
        stream_id: "stream-123",
        playback_id: "playback-456",
        duration_seconds: 91,
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("duration_seconds must be between 5 and 90");
    expect(CREATED_CLIPS.length).toBe(0);
  });

  it("should generate unique clip IDs", async () => {
    const req1 = new NextRequest("http://localhost/api/routes-f/create-clip", {
      method: "POST",
      body: JSON.stringify({ stream_id: "s1", playback_id: "p1" }),
    });
    const req2 = new NextRequest("http://localhost/api/routes-f/create-clip", {
      method: "POST",
      body: JSON.stringify({ stream_id: "s2", playback_id: "p2" }),
    });

    const res1 = await POST(req1);
    const res2 = await POST(req2);

    const data1 = await res1.json();
    const data2 = await res2.json();

    expect(data1.clip_id).not.toBe(data2.clip_id);
    expect(CREATED_CLIPS.length).toBe(2);
  });
});
