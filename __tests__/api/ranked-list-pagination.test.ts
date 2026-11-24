/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { GET as getTopUsers } from "@/app/api/users/top/route";
import { GET as getLiveStreams } from "@/app/api/streams/live/route";
import {
  decodeRankedCursor,
  encodeRankedCursor,
} from "@/lib/pagination/ranked";

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

const mockSql = sql as unknown as jest.Mock;

const ID_1 = "11111111-1111-4111-8111-111111111111";
const ID_2 = "22222222-2222-4222-8222-222222222222";
const ID_3 = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  mockSql.mockReset();
});

describe("GET /api/users/top pagination", () => {
  it("returns standardized envelope { items, nextCursor, hasMore } and users alias", async () => {
    mockSql.mockResolvedValueOnce({
      rows: [
        {
          id: ID_3,
          username: "alice",
          avatar: null,
          is_live: true,
          current_viewers: 120,
          follower_count: 500,
        },
        {
          id: ID_2,
          username: "bob",
          avatar: null,
          is_live: false,
          current_viewers: 0,
          follower_count: 400,
        },
        {
          id: ID_1,
          username: "charlie",
          avatar: null,
          is_live: false,
          current_viewers: 0,
          follower_count: 300,
        },
      ],
    });

    const req = new NextRequest("http://localhost/api/users/top?limit=2");
    const res = await getTopUsers(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.users).toEqual(body.items);
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toEqual(expect.any(String));
    expect(decodeRankedCursor(body.nextCursor, 2)).toEqual({
      scores: [400, 0],
      id: ID_2,
    });
  });

  it("rejects offset and invalid limit/cursor without querying DB", async () => {
    for (const query of ["offset=5", "limit=0", "limit=abc", "cursor=bad"]) {
      const req = new NextRequest(`http://localhost/api/users/top?${query}`);
      const res = await getTopUsers(req);
      expect(res.status).toBe(400);
    }
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("accepts a valid cursor for subsequent pages", async () => {
    mockSql.mockResolvedValueOnce({ rows: [] });
    const cursor = encodeRankedCursor({ scores: [400, 0], id: ID_2 });
    const req = new NextRequest(
      `http://localhost/api/users/top?limit=2&cursor=${cursor}`
    );
    const res = await getTopUsers(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [],
      users: [],
      nextCursor: null,
      hasMore: false,
    });
  });
});

describe("GET /api/streams/live pagination", () => {
  it("returns standardized envelope { items, nextCursor, hasMore } and streams alias", async () => {
    mockSql.mockResolvedValueOnce({
      rows: [
        {
          id: ID_3,
          username: "streamer1",
          avatar: null,
          mux_playback_id: "pb1",
          current_viewers: 250,
          total_views: 1000,
          stream_started_at: "2026-11-24T10:00:00Z",
          creator: { streamTitle: "Live 1", category: "Gaming", tags: [] },
          is_following: 0,
        },
        {
          id: ID_2,
          username: "streamer2",
          avatar: null,
          mux_playback_id: "pb2",
          current_viewers: 100,
          total_views: 500,
          stream_started_at: "2026-11-24T09:00:00Z",
          creator: { streamTitle: "Live 2", category: "Music", tags: [] },
          is_following: 0,
        },
      ],
    });

    const req = new Request("http://localhost/api/streams/live?limit=1");
    const res = await getLiveStreams(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.streams).toEqual(body.items);
    expect(body.items[0]).toMatchObject({
      id: ID_3,
      username: "streamer1",
      viewerCount: 250,
      isFollowing: false,
    });
    expect(body.hasMore).toBe(true);
    expect(decodeRankedCursor(body.nextCursor, 2)).toEqual({
      scores: [0, 250],
      id: ID_3,
    });
  });

  it("supports viewer_wallet personalization with ranked cursor", async () => {
    mockSql.mockResolvedValueOnce({
      rows: [
        {
          id: ID_1,
          username: "followed",
          avatar: null,
          mux_playback_id: "pb-f",
          current_viewers: 15,
          total_views: 80,
          stream_started_at: "2026-11-24T10:00:00Z",
          creator: { streamTitle: "Followed Stream" },
          is_following: 1,
        },
      ],
    });

    const req = new Request(
      "http://localhost/api/streams/live?limit=10&viewer_wallet=GABC123"
    );
    const res = await getLiveStreams(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].isFollowing).toBe(true);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
  });

  it("rejects offset and invalid limit/cursor without querying DB", async () => {
    for (const query of ["offset=50", "limit=-1", "cursor=invalid"]) {
      const req = new Request(`http://localhost/api/streams/live?${query}`);
      const res = await getLiveStreams(req);
      expect(res.status).toBe(400);
    }
    expect(mockSql).not.toHaveBeenCalled();
  });
});
