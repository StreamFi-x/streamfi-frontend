/**
 * @jest-environment node
 */
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PaginationError,
} from "@/lib/pagination/cursor";
import {
  buildRankedPage,
  decodeRankedCursor,
  encodeRankedCursor,
  parseRankedPageParams,
  rankedKeysetBounds,
  readRankedPageParams,
  type RankedKeysetPosition,
} from "@/lib/pagination/ranked";

const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ID_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const params = (query: string) => new URLSearchParams(query);

describe("ranked cursor encoding", () => {
  it("round-trips a ranked position without exposing it in plain text", () => {
    const cursor = encodeRankedCursor({ scores: [42, 10], id: ID_A });

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(cursor).not.toContain(ID_A);
    expect(decodeRankedCursor(cursor, 2)).toEqual({
      scores: [42, 10],
      id: ID_A,
    });
  });

  it("normalizes uppercase UUIDs to lowercase", () => {
    const cursor = encodeRankedCursor({
      scores: [1, 0],
      id: ID_A.toUpperCase(),
    });
    expect(decodeRankedCursor(cursor, 2)).toEqual({
      scores: [1, 0],
      id: ID_A,
    });
  });

  it("rejects encoding invalid positions", () => {
    expect(() => encodeRankedCursor({ scores: [], id: ID_A })).toThrow(
      PaginationError
    );
    expect(() => encodeRankedCursor({ scores: [-1], id: ID_A })).toThrow(
      PaginationError
    );
    expect(() => encodeRankedCursor({ scores: [1.5], id: ID_A })).toThrow(
      PaginationError
    );
    expect(() =>
      encodeRankedCursor({ scores: [2_147_483_648], id: ID_A })
    ).toThrow(PaginationError);
    expect(() => encodeRankedCursor({ scores: [1], id: "not-a-uuid" })).toThrow(
      PaginationError
    );
  });

  const forge = (payload: unknown) =>
    Buffer.from(JSON.stringify(payload)).toString("base64url");

  it.each([
    ["empty", ""],
    ["not base64 json", "%%%"],
    ["non-object json", forge(123)],
    ["wrong version", forge({ v: 2, s: [10, 5], i: ID_A })],
    ["wrong score arity", forge({ v: 1, s: [10], i: ID_A })],
    ["negative score", forge({ v: 1, s: [10, -1], i: ID_A })],
    ["float score", forge({ v: 1, s: [10, 1.5], i: ID_A })],
    ["int4 overflow score", forge({ v: 1, s: [2_147_483_648, 0], i: ID_A })],
    ["non-number score", forge({ v: 1, s: ["10", 5], i: ID_A })],
    ["non-uuid id", forge({ v: 1, s: [10, 5], i: "1 OR 1=1" })],
    ["oversized", "a".repeat(300)],
  ])("rejects a %s cursor", (_name, raw) => {
    expect(() => decodeRankedCursor(raw, 2)).toThrow(PaginationError);
  });
});

describe("parseRankedPageParams", () => {
  it("defaults to first page with configured default limit", () => {
    expect(parseRankedPageParams(params(""), { scoreCount: 2 })).toEqual({
      limit: DEFAULT_PAGE_SIZE,
      after: null,
    });
    expect(
      parseRankedPageParams(params(""), {
        defaultLimit: 5,
        maxLimit: 20,
        scoreCount: 2,
      })
    ).toEqual({
      limit: 5,
      after: null,
    });
  });

  it("clamps oversized limit to maxLimit", () => {
    expect(
      parseRankedPageParams(params("limit=999"), {
        maxLimit: 20,
        scoreCount: 2,
      }).limit
    ).toBe(20);
    expect(
      parseRankedPageParams(params("limit=999"), { scoreCount: 2 }).limit
    ).toBe(MAX_PAGE_SIZE);
  });

  it.each(["0", "-1", "1.5", "abc", "", "1e3"])("rejects limit=%p", raw => {
    expect(() =>
      parseRankedPageParams(params(`limit=${encodeURIComponent(raw)}`), {
        scoreCount: 2,
      })
    ).toThrow(PaginationError);
  });

  it("rejects offset parameter", () => {
    expect(() =>
      parseRankedPageParams(params("offset=10"), { scoreCount: 2 })
    ).toThrow(/cursor/);
  });

  it("decodes valid cursor and rejects tampered cursor", () => {
    const cursor = encodeRankedCursor({ scores: [5, 2], id: ID_A });
    expect(
      parseRankedPageParams(params(`cursor=${cursor}`), { scoreCount: 2 }).after
    ).toEqual({ scores: [5, 2], id: ID_A });

    expect(() =>
      parseRankedPageParams(params(`cursor=${cursor.slice(0, -2)}x`), {
        scoreCount: 2,
      })
    ).toThrow(PaginationError);
  });
});

describe("readRankedPageParams", () => {
  it("returns ok:false with 400 response on PaginationError", async () => {
    const res = readRankedPageParams(params("offset=5"), { scoreCount: 2 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.response.status).toBe(400);
      const body = await res.response.json();
      expect(body.error).toMatch(/cursor/i);
    }
  });
});

describe("rankedKeysetBounds", () => {
  it("returns INT4 max sentinels for the first page", () => {
    expect(rankedKeysetBounds(null, 2)).toEqual({
      scores: [2_147_483_647, 2_147_483_647],
      id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    });
  });

  it("passes through an existing cursor position", () => {
    const pos: RankedKeysetPosition = { scores: [10, 3], id: ID_A };
    expect(rankedKeysetBounds(pos, 2)).toBe(pos);
  });
});

describe("buildRankedPage", () => {
  const rows = [
    { id: ID_C, score1: 100, score2: 50, name: "first" },
    { id: ID_B, score1: 100, score2: 50, name: "second" },
    { id: ID_A, score1: 80, score2: 10, name: "third" },
  ];

  it("slices to limit and emits nextCursor when extra row is present", () => {
    const page = buildRankedPage(
      rows,
      2,
      r => r.name,
      r => ({ scores: [r.score1, r.score2], id: r.id })
    );

    expect(page.items).toEqual(["first", "second"]);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();
    expect(decodeRankedCursor(page.nextCursor!, 2)).toEqual({
      scores: [100, 50],
      id: ID_B,
    });
  });

  it("returns hasMore=false and nextCursor=null on the final page", () => {
    const page = buildRankedPage(
      rows.slice(0, 2),
      2,
      r => r.name,
      r => ({ scores: [r.score1, r.score2], id: r.id })
    );

    expect(page.items).toEqual(["first", "second"]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("handles empty results", () => {
    const page = buildRankedPage(
      [],
      5,
      (r: (typeof rows)[number]) => r.name,
      r => ({ scores: [r.score1, r.score2], id: r.id })
    );

    expect(page).toEqual({ items: [], nextCursor: null, hasMore: false });
  });
});
