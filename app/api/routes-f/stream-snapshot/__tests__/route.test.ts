/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, GET } from "../route";

function makeReq(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/routes-f/stream-snapshot", {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/routes-f/stream-snapshot", () => {
  it("creates snapshot with provided timestamp", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
        playback_id: "playback456",
        timestamp: 123,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.snapshot_url).toBe(
      "https://image.mux.com/playback456/thumbnail.jpg?time=123"
    );
    expect(body.captured_at).toBeDefined();
  });

  it("creates snapshot with default timestamp", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
        playback_id: "playback456",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.snapshot_url).toMatch(
      /^https:\/\/image\.mux\.com\/playback456\/thumbnail\.jpg\?time=\d+$/
    );
    expect(body.captured_at).toBeDefined();
  });

  it("rejects non-numeric timestamp with 400", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
        playback_id: "playback456",
        timestamp: "not-a-number",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing stream_id", async () => {
    const res = await POST(
      makeReq("POST", {
        playback_id: "playback456",
        timestamp: 123,
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing playback_id", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
        timestamp: 123,
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/stream-snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "invalid json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/routes-f/stream-snapshot", () => {
  beforeEach(async () => {
    // Setup: create multiple snapshots
    await POST(
      makeReq("POST", {
        stream_id: "getstream",
        playback_id: "playback1",
        timestamp: 100,
      })
    );
    await POST(
      makeReq("POST", {
        stream_id: "getstream",
        playback_id: "playback2",
        timestamp: 200,
      })
    );
    await POST(
      makeReq("POST", {
        stream_id: "getstream",
        playback_id: "playback3",
        timestamp: 300,
      })
    );
  });

  it("returns last 10 snapshots for stream", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/stream-snapshot?stream_id=getstream"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.snapshots).toHaveLength(3);
    expect(body.snapshots[0].stream_id).toBe("getstream");
    expect(body.snapshots[0].playback_id).toBe("playback1");
  });

  it("returns empty array for stream with no snapshots", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/stream-snapshot?stream_id=nosnapshots"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.snapshots).toHaveLength(0);
  });

  it("returns 400 when stream_id is missing", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/stream-snapshot");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns only last 10 snapshots when more exist", async () => {
    // Create 15 snapshots
    for (let i = 0; i < 15; i++) {
      await POST(
        makeReq("POST", {
          stream_id: "manystream",
          playback_id: `playback${i}`,
          timestamp: i * 100,
        })
      );
    }

    const req = new NextRequest(
      "http://localhost/api/routes-f/stream-snapshot?stream_id=manystream"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.snapshots).toHaveLength(10);
  });
});
