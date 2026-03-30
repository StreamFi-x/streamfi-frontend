jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => jest.fn().mockResolvedValue(false),
}));

import { sql } from "@vercel/postgres";
import { GET } from "../route";

const sqlMock = sql as unknown as jest.Mock;

const makeRequest = (search = "") =>
  new Request(`http://localhost/api/search${search}`) as unknown as import("next/server").NextRequest;

let consoleErrorSpy: jest.SpyInstance;

describe("GET /api/search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it("returns 400 when q is missing", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/query parameter 'q'/i);
  });

  it("returns 400 for an invalid type", async () => {
    const res = await GET(makeRequest("?q=alice&type=invalid"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid search type/i);
  });

  it("returns empty groups for short queries", async () => {
    const res = await GET(makeRequest("?q=a"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toEqual([]);
    expect(body.streams).toEqual([]);
    expect(body.categories).toEqual([]);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns grouped results for all search types", async () => {
    sqlMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-1",
            username: "alice",
            avatar: "/alice.png",
            is_live: true,
            follower_count: 42,
            bio: "FPS streamer",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "stream-1",
            username: "alice",
            avatar: "/alice.png",
            current_viewers: 99,
            stream_title: "Valorant Ranked",
            category: "Gaming",
            tags: ["valorant", "ranked"],
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "cat-1",
            title: "Gaming",
            tags: ["gaming", "fps"],
            imageurl: "/gaming.png",
          },
        ],
      });

    const res = await GET(makeRequest("?q=valorant&type=all&limit=5"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.users).toHaveLength(1);
    expect(body.streams).toHaveLength(1);
    expect(body.categories).toHaveLength(1);
    expect(body.streams[0].stream_title).toBe("Valorant Ranked");
  });

  it("skips unrelated queries when filtering to users", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: "user-1", username: "alice", avatar: null, is_live: false, follower_count: 7, bio: null }],
    });

    const res = await GET(makeRequest("?q=alice&type=users"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.users).toHaveLength(1);
    expect(body.streams).toEqual([]);
    expect(body.categories).toEqual([]);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when the database throws", async () => {
    sqlMock.mockRejectedValueOnce(new Error("db down"));

    const res = await GET(makeRequest("?q=alice"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/failed to search/i);
  });
});