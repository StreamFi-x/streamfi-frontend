/**
 * @jest-environment node
 */
import {
  buildRankedPage,
  decodeRankedCursor,
  encodeRankedCursor,
  parseRankedParams,
  rankedBounds,
  readRankedParams,
} from "@/lib/pagination/ranked";
import { PaginationError } from "@/lib/pagination/cursor";

const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const params = (q: string) => new URLSearchParams(q);

describe("ranked cursor", () => {
  it("round-trips scores and id", () => {
    const cursor = encodeRankedCursor({ scores: [3, 120], id: ID_A });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeRankedCursor(cursor, 2)).toEqual({
      scores: [3, 120],
      id: ID_A,
    });
  });

  it("lowercases the id", () => {
    const cursor = encodeRankedCursor({ scores: [1], id: ID_A.toUpperCase() });
    expect(decodeRankedCursor(cursor, 1).id).toBe(ID_A);
  });

  it.each([
    ["empty", ""],
    ["not base64 json", "!!!"],
    ["too long", "a".repeat(300)],
    ["json null", Buffer.from("null").toString("base64url")],
    [
      "wrong version",
      Buffer.from(JSON.stringify({ v: 9, s: [1], i: ID_A })).toString(
        "base64url"
      ),
    ],
    [
      "non-integer score",
      Buffer.from(JSON.stringify({ v: 1, s: [1.5], i: ID_A })).toString(
        "base64url"
      ),
    ],
    [
      "string score",
      Buffer.from(JSON.stringify({ v: 1, s: ["1"], i: ID_A })).toString(
        "base64url"
      ),
    ],
    [
      "bad id",
      Buffer.from(JSON.stringify({ v: 1, s: [1], i: "nope" })).toString(
        "base64url"
      ),
    ],
  ])("rejects a %s cursor", (_label, raw) => {
    expect(() => decodeRankedCursor(raw, 1)).toThrow(PaginationError);
  });

  it("rejects a cursor issued for a different ranking", () => {
    const cursor = encodeRankedCursor({ scores: [1, 2], id: ID_A });
    expect(() => decodeRankedCursor(cursor, 1)).toThrow(PaginationError);
  });
});

describe("parseRankedParams", () => {
  it("uses defaults for the first page", () => {
    expect(parseRankedParams(params(""), 2, { defaultLimit: 5 })).toEqual({
      limit: 5,
      after: null,
    });
  });

  it("clamps limit to the maximum", () => {
    expect(
      parseRankedParams(params("limit=500"), 2, { maxLimit: 20 }).limit
    ).toBe(20);
  });

  it.each(["0", "-1", "abc", "1.5", ""])("rejects limit=%s", limit => {
    expect(() => parseRankedParams(params(`limit=${limit}`), 2)).toThrow(
      PaginationError
    );
  });

  it("rejects offset so old clients fail loudly", () => {
    expect(() => parseRankedParams(params("offset=10"), 2)).toThrow(
      PaginationError
    );
  });

  it("decodes a supplied cursor", () => {
    const cursor = encodeRankedCursor({ scores: [0, 7], id: ID_B });
    expect(parseRankedParams(params(`cursor=${cursor}`), 2).after).toEqual({
      scores: [0, 7],
      id: ID_B,
    });
  });

  it("throws RangeError for an unsupported score count", () => {
    expect(() => parseRankedParams(params(""), 0)).toThrow(RangeError);
    expect(() => parseRankedParams(params(""), 5)).toThrow(RangeError);
  });
});

describe("readRankedParams", () => {
  it("returns ok with the page params", () => {
    const result = readRankedParams(params("limit=3"), 2);
    expect(result.ok && result.page.limit).toBe(3);
  });

  it("returns a 400 response for bad input", async () => {
    const result = readRankedParams(params("cursor=junk"), 2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      expect(await result.response.json()).toEqual({ error: "Invalid cursor" });
    }
  });
});

describe("rankedBounds", () => {
  it("short-circuits the first page with neutral bind values", () => {
    expect(rankedBounds(null, 2)).toEqual({
      isFirstPage: true,
      scores: [0, 0],
      id: "00000000-0000-0000-0000-000000000000",
    });
  });

  it("passes a cursor position through", () => {
    expect(rankedBounds({ scores: [4, 9], id: ID_A }, 2)).toEqual({
      isFirstPage: false,
      scores: [4, 9],
      id: ID_A,
    });
  });
});

describe("buildRankedPage", () => {
  const row = (id: string, a: number, b: number) => ({
    id,
    rank_scores: [a, b],
  });

  it("returns a full page with a cursor at the last returned row", () => {
    const page = buildRankedPage(
      [row(ID_A, 5, 10), row(ID_B, 4, 8), row("c", 1, 1)],
      2,
      r => r.id
    );
    expect(page.items).toEqual([ID_A, ID_B]);
    expect(page.hasMore).toBe(true);
    expect(decodeRankedCursor(page.nextCursor as string, 2)).toEqual({
      scores: [4, 8],
      id: ID_B,
    });
  });

  it("ends the list when rows do not exceed the limit", () => {
    const page = buildRankedPage([row(ID_A, 1, 1)], 2, r => r.id);
    expect(page).toEqual({ items: [ID_A], nextCursor: null, hasMore: false });
  });

  it("is exactly full without a further page", () => {
    const page = buildRankedPage(
      [row(ID_A, 1, 1), row(ID_B, 1, 0)],
      2,
      r => r.id
    );
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("returns the empty envelope", () => {
    expect(buildRankedPage([], 5, r => r)).toEqual({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("coerces bigint-as-string scores from the driver", () => {
    const page = buildRankedPage(
      [
        { id: ID_A, rank_scores: ["3", "4"] as unknown as number[] },
        row(ID_B, 0, 0),
      ],
      1,
      r => r.id
    );
    expect(decodeRankedCursor(page.nextCursor as string, 2).scores).toEqual([
      3, 4,
    ]);
  });
});
