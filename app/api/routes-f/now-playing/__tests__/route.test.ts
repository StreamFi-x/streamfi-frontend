import { NextRequest } from "next/server";
import { POST, GET, DELETE } from "../route";

function makeRequest(method: string, body?: unknown, query?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/routes-f/now-playing");
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }
  const init: RequestInit & { headers?: Record<string, string> } = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(url.toString(), init);
}

describe("POST /now-playing", () => {
  it("creates the first track for a stream", async () => {
    const res = await POST(makeRequest("POST", {
      stream_id: "stream-1",
      artist: "Artist A",
      title: "Track 1",
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("updated_at");
    expect(typeof body.updated_at).toBe("string");
  });

  it("moves current to history when a new track is posted", async () => {
    await POST(makeRequest("POST", {
      stream_id: "stream-2",
      artist: "Artist A",
      title: "First",
    }));
    await POST(makeRequest("POST", {
      stream_id: "stream-2",
      artist: "Artist B",
      title: "Second",
      album: "Album",
      art_url: "https://example.com/art.jpg",
    }));
    const res = await GET(makeRequest("GET", undefined, { stream_id: "stream-2" }));
    const body = await res.json();
    expect(body.current).toEqual({
      stream_id: "stream-2",
      artist: "Artist B",
      title: "Second",
      album: "Album",
      art_url: "https://example.com/art.jpg",
      played_at: expect.any(String),
    });
    expect(body.history).toHaveLength(1);
    expect(body.history[0].title).toBe("First");
  });

  it("rejects missing required fields", async () => {
    const res = await POST(makeRequest("POST", { stream_id: "s-1" }));
    expect(res.status).toBe(400);
  });
});

describe("GET /now-playing", () => {
  it("returns null current and empty history for a fresh stream", async () => {
    const res = await GET(makeRequest("GET", undefined, { stream_id: "unknown" }));
    const body = await res.json();
    expect(body.current).toBeNull();
    expect(body.history).toEqual([]);
  });

  it("returns at most 10 history entries", async () => {
    for (let i = 0; i < 15; i++) {
      await POST(makeRequest("POST", {
        stream_id: "stream-3",
        artist: "Artist",
        title: `Track ${i}`,
      }));
    }
    const res = await GET(makeRequest("GET", undefined, { stream_id: "stream-3" }));
    const body = await res.json();
    expect(body.history).toHaveLength(10);
    expect(body.current.title).toBe("Track 14");
    expect(body.history[0].title).toBe("Track 13");
  });

  it("rejects missing stream_id", async () => {
    const res = await GET(makeRequest("GET", undefined, {}));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /now-playing", () => {
  it("clears all track data for a stream", async () => {
    await POST(makeRequest("POST", {
      stream_id: "stream-4",
      artist: "Artist",
      title: "Track",
    }));
    const before = await GET(makeRequest("GET", undefined, { stream_id: "stream-4" }));
    expect((await before.json()).current).not.toBeNull();

    const delRes = await DELETE(makeRequest("DELETE", undefined, { stream_id: "stream-4" }));
    expect(delRes.status).toBe(200);
    expect((await delRes.json()).message).toBe("Now-playing cleared");

    const after = await GET(makeRequest("GET", undefined, { stream_id: "stream-4" }));
    const afterBody = await after.json();
    expect(afterBody.current).toBeNull();
    expect(afterBody.history).toEqual([]);
  });

  it("rejects missing stream_id", async () => {
    const res = await DELETE(makeRequest("DELETE", undefined, {}));
    expect(res.status).toBe(400);
  });
});
