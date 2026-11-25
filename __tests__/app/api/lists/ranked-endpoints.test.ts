/**
 * @jest-environment node
 *
 * Ranked keyset pagination on GET /api/streams/live and GET /api/users/top
 * (#1723): shared envelope, validation, and cursor-driven paging.
 */
import { NextRequest } from "next/server";
import { createSqlMock } from "@/testing/sql-mock";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockDb.sql(...args),
}));

import { GET as getLive } from "@/app/api/streams/live/route";
import { GET as getTop } from "@/app/api/users/top/route";
import { decodeRankedCursor } from "@/lib/pagination/ranked";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const liveRow = (n: number, viewers: number, following = 0) => ({
  id: id(n),
  username: `user${n}`,
  avatar: null,
  mux_playback_id: `pb${n}`,
  current_viewers: viewers,
  total_views: 100,
  stream_started_at: "2026-09-25T10:00:00.000Z",
  creator: { streamTitle: `Stream ${n}` },
  is_following: following,
});

const topRow = (n: number, followers: number, viewers: number) => ({
  id: id(n),
  username: `user${n}`,
  avatar: null,
  is_live: false,
  current_viewers: viewers,
  follower_count: followers,
});

beforeEach(() => {
  mockDb.reset();
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/streams/live", () => {
  const call = (query = "") =>
    getLive(new Request(`http://localhost/api/streams/live${query}`));

  it("returns the shared envelope with a legacy streams alias", async () => {
    mockDb.on(/FROM users u/, { rows: [liveRow(3, 50), liveRow(2, 40)] });
    const body = await (await call()).json();

    expect(body.items).toHaveLength(2);
    expect(body.streams).toEqual(body.items);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
    expect(body.items[0]).toMatchObject({ id: id(3), viewerCount: 50 });
  });

  it("fetches limit + 1 rows and returns a cursor when more exist", async () => {
    mockDb.on(/FROM users u/, {
      rows: [liveRow(3, 50), liveRow(2, 40), liveRow(1, 30)],
    });
    const body = await (await call("?limit=2")).json();

    expect(body.items).toHaveLength(2);
    expect(body.hasMore).toBe(true);
    expect(decodeRankedCursor(body.nextCursor, 2)).toEqual({
      scores: [0, 40],
      id: id(2),
    });
    expect(mockDb.calls[0].values).toContain(3);
  });

  it("binds the cursor position for the next page", async () => {
    mockDb.on(/FROM users u/, { rows: [] });
    const first = await (async () => {
      mockDb.reset();
      mockDb.on(/FROM users u/, {
        rows: [liveRow(3, 50), liveRow(2, 40), liveRow(1, 30)],
      });
      return (await call("?limit=2")).json();
    })();

    mockDb.reset();
    mockDb.on(/FROM users u/, { rows: [liveRow(1, 30)] });
    const second = await (
      await call(`?limit=2&cursor=${first.nextCursor}`)
    ).json();

    expect(second.items).toHaveLength(1);
    expect(second.hasMore).toBe(false);
    const { values } = mockDb.calls[0];
    expect(values).toEqual(expect.arrayContaining([0, 40, id(2)]));
  });

  it("ranks followed streams first and flags them", async () => {
    mockDb.on(/FROM users u/, { rows: [liveRow(2, 5, 1), liveRow(3, 90, 0)] });
    const body = await (await call("?viewer_wallet=GABC")).json();

    expect(body.items[0]).toMatchObject({ id: id(2), isFollowing: true });
    expect(body.items[1]).toMatchObject({ id: id(3), isFollowing: false });
  });

  it("returns the empty envelope", async () => {
    mockDb.on(/FROM users u/, { rows: [] });
    expect(await (await call()).json()).toEqual({
      items: [],
      nextCursor: null,
      hasMore: false,
      streams: [],
    });
  });

  it.each(["?offset=10", "?limit=abc", "?limit=0", "?cursor=junk"])(
    "rejects %s with 400 before touching the DB",
    async query => {
      const res = await call(query);
      expect(res.status).toBe(400);
      expect(mockDb.calls).toHaveLength(0);
    }
  );

  it("clamps an oversized limit to the maximum", async () => {
    mockDb.on(/FROM users u/, { rows: [] });
    await call("?limit=9999");
    expect(mockDb.calls[0].values).toContain(51);
  });

  it("returns 500 when the database fails", async () => {
    mockDb.on(/FROM users u/, () => {
      throw new Error("db down");
    });
    expect((await call()).status).toBe(500);
  });
});

describe("GET /api/users/top", () => {
  const call = (query = "") =>
    getTop(new NextRequest(`http://localhost/api/users/top${query}`));

  it("keeps the default of 5 and the legacy users alias", async () => {
    mockDb.on(/FROM users u/, { rows: [topRow(1, 9, 1)] });
    const body = await (await call()).json();

    expect(mockDb.calls[0].values).toContain(6);
    expect(body.users).toEqual(body.items);
    expect(body.items[0]).toEqual({
      username: "user1",
      avatar: null,
      is_live: false,
      current_viewers: 1,
      follower_count: 9,
    });
    expect(body.items[0]).not.toHaveProperty("id");
  });

  it("clamps limit to 20", async () => {
    mockDb.on(/FROM users u/, { rows: [] });
    await call("?limit=500");
    expect(mockDb.calls[0].values).toContain(21);
  });

  it("pages by followers then viewers then id", async () => {
    mockDb.on(/FROM users u/, {
      rows: [topRow(3, 10, 4), topRow(2, 10, 2), topRow(1, 3, 0)],
    });
    const body = await (await call("?limit=2")).json();

    expect(body.hasMore).toBe(true);
    expect(decodeRankedCursor(body.nextCursor, 2)).toEqual({
      scores: [10, 2],
      id: id(2),
    });
  });

  it.each(["?offset=5", "?limit=-3", "?cursor=nope"])(
    "rejects %s with 400",
    async query => {
      expect((await call(query)).status).toBe(400);
      expect(mockDb.calls).toHaveLength(0);
    }
  );

  it("returns 500 when the database fails", async () => {
    mockDb.on(/FROM users u/, () => {
      throw new Error("db down");
    });
    expect((await call()).status).toBe(500);
  });
});
