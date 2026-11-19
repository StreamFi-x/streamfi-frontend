/**
 * @jest-environment node
 */
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PaginationError,
  buildPage,
  decodeCursor,
  encodeCursor,
  keysetBounds,
  parsePageParams,
  type KeysetPosition,
} from "@/lib/pagination/cursor";

const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TS = "2026-09-25T10:00:00.123456Z";

const params = (query: string) => new URLSearchParams(query);

describe("cursor encoding", () => {
  it("round-trips a position without exposing it in plain text", () => {
    const cursor = encodeCursor({ ts: TS, id: ID_A });

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(cursor).not.toContain(ID_A);
    expect(decodeCursor(cursor)).toEqual({ ts: TS, id: ID_A });
  });

  it("keeps microsecond precision that a JS Date would drop", () => {
    const decoded = decodeCursor(encodeCursor({ ts: TS, id: ID_A }));
    expect(decoded.ts.endsWith(".123456Z")).toBe(true);
  });

  const forge = (payload: unknown) =>
    Buffer.from(JSON.stringify(payload)).toString("base64url");

  it.each([
    ["empty", ""],
    ["not base64 json", "%%%"],
    ["json but not an object", forge(42)],
    ["wrong version", forge({ v: 2, t: TS, i: ID_A })],
    ["missing id", forge({ v: 1, t: TS })],
    [
      "non-uuid id (SQL injection attempt)",
      forge({ v: 1, t: TS, i: "1 OR 1=1" }),
    ],
    [
      "millisecond timestamp",
      forge({ v: 1, t: "2026-09-25T10:00:00.123Z", i: ID_A }),
    ],
    [
      "impossible date",
      forge({ v: 1, t: "2026-02-30T00:00:00.000000Z", i: ID_A }),
    ],
    ["hour 24", forge({ v: 1, t: "2026-02-01T24:00:00.000000Z", i: ID_A })],
    ["oversized", "a".repeat(300)],
  ])("rejects a %s cursor", (_name, raw) => {
    expect(() => decodeCursor(raw)).toThrow(PaginationError);
  });
});

describe("parsePageParams", () => {
  it("defaults to the first page with the default size", () => {
    expect(parsePageParams(params(""))).toEqual({
      limit: DEFAULT_PAGE_SIZE,
      after: null,
    });
  });

  it("honours per-endpoint defaults and maximums", () => {
    expect(
      parsePageParams(params(""), { defaultLimit: 50, maxLimit: 200 }).limit
    ).toBe(50);
    expect(parsePageParams(params("limit=150"), { maxLimit: 200 }).limit).toBe(
      150
    );
  });

  it("clamps an oversized limit to the maximum", () => {
    expect(parsePageParams(params("limit=100000")).limit).toBe(MAX_PAGE_SIZE);
  });

  it.each(["0", "-1", "1.5", "abc", "", "1e3", " 5"])(
    "rejects limit=%p",
    raw => {
      expect(() =>
        parsePageParams(params(`limit=${encodeURIComponent(raw)}`))
      ).toThrow(PaginationError);
    }
  );

  it("rejects the retired offset parameter instead of ignoring it", () => {
    expect(() => parsePageParams(params("offset=40"))).toThrow(/cursor/);
  });

  it("decodes a valid cursor and rejects a tampered one", () => {
    const cursor = encodeCursor({ ts: TS, id: ID_A });
    expect(parsePageParams(params(`cursor=${cursor}`)).after).toEqual({
      ts: TS,
      id: ID_A,
    });
    expect(() =>
      parsePageParams(params(`cursor=${cursor.slice(0, -3)}x`))
    ).toThrow(PaginationError);
  });
});

describe("keysetBounds", () => {
  it("uses sentinels that sort after every row on the first page", () => {
    expect(keysetBounds(null)).toEqual({
      ts: "infinity",
      id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    });
  });
});

// ── An in-memory model of the SQL every paginated endpoint runs ─────────────
//   WHERE (created_at, id) < (cursor.ts, cursor.id)
//   ORDER BY created_at DESC, id DESC LIMIT limit + 1
// Timestamps are compared as fixed-width microsecond strings, as Postgres does.

interface Row {
  id: string;
  cursor_ts: string;
}

function compareDesc(a: Row, b: Row): number {
  if (a.cursor_ts !== b.cursor_ts) {
    return a.cursor_ts < b.cursor_ts ? 1 : -1;
  }
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

function before(row: Row, bound: KeysetPosition): boolean {
  if (bound.ts === "infinity") {
    return true;
  }
  return (
    row.cursor_ts < bound.ts ||
    (row.cursor_ts === bound.ts && row.id < bound.id)
  );
}

function fetchPage(table: Row[], cursor: string | null, limit: number) {
  const bound = keysetBounds(cursor ? decodeCursor(cursor) : null);
  const rows = table
    .filter(r => before(r, bound))
    .sort(compareDesc)
    .slice(0, limit + 1);
  return buildPage(rows, limit, r => r.id);
}

let seq = 0;
function uuid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${seq.toString(16).padStart(12, "0")}`;
}

function row(ts: string): Row {
  return { id: uuid(), cursor_ts: ts };
}

function drain(
  table: Row[],
  limit: number,
  onPage?: (page: number) => void
): string[] {
  const seen: string[] = [];
  let cursor: string | null = null;
  let page = 0;
  do {
    const result = fetchPage(table, cursor, limit);
    seen.push(...result.items);
    cursor = result.nextCursor;
    onPage?.(++page);
    if (page > 1000) {
      throw new Error("pagination did not terminate");
    }
  } while (cursor);
  return seen;
}

describe("keyset pagination correctness", () => {
  it("returns an empty final page with no cursor for an empty table", () => {
    expect(fetchPage([], null, 10)).toEqual({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("stops exactly at the end when the row count is a multiple of the limit", () => {
    const table = Array.from({ length: 20 }, (_, i) =>
      row(`2026-09-25T10:00:${String(i).padStart(2, "0")}.000000Z`)
    );
    const first = fetchPage(table, null, 10);
    const second = fetchPage(table, first.nextCursor, 10);

    expect(first.hasMore).toBe(true);
    expect(second).toMatchObject({ hasMore: false, nextCursor: null });
    expect(second.items).toHaveLength(10);
  });

  it("neither skips nor repeats rows that share a timestamp across page boundaries", () => {
    // 25 rows in the same microsecond, as happens with bursty chat.
    const table = Array.from({ length: 25 }, () => row(TS));
    table.push(row("2026-09-25T09:59:59.999999Z"));

    const seen = drain(table, 4);

    expect(seen).toHaveLength(table.length);
    expect(new Set(seen).size).toBe(table.length);
    expect(seen).toEqual([...table].sort(compareDesc).map(r => r.id));
  });

  it("distinguishes rows one microsecond apart", () => {
    const newer = row("2026-09-25T10:00:00.000002Z");
    const older = row("2026-09-25T10:00:00.000001Z");

    const seen = drain([older, newer], 1);

    expect(seen).toEqual([newer.id, older.id]);
  });

  it("is stable under concurrent inserts: no duplicates, no skipped rows", () => {
    const initial = Array.from({ length: 50 }, (_, i) =>
      row(`2026-09-25T09:00:${String(i).padStart(2, "0")}.000000Z`)
    );
    const table = [...initial];

    // After every page, new rows arrive at the head (newer timestamps, some
    // tied with each other) while the client keeps paging back through history.
    const seen = drain(table, 7, page => {
      for (let i = 0; i < 3; i++) {
        table.push(
          row(`2026-09-25T11:00:${String(page).padStart(2, "0")}.000000Z`)
        );
      }
    });

    expect(new Set(seen).size).toBe(seen.length);
    for (const r of initial) {
      expect(seen).toContain(r.id);
    }
    // Rows inserted after the first page are newer than the cursor, so they
    // never leak into later pages (OFFSET pagination would shift and repeat).
    expect(seen.filter(id => !initial.some(r => r.id === id))).toHaveLength(0);
  });

  it("contrasts with OFFSET pagination, which repeats rows under the same inserts", () => {
    const table = Array.from({ length: 20 }, (_, i) =>
      row(`2026-09-25T09:00:${String(i).padStart(2, "0")}.000000Z`)
    );
    const offsetPage = (offset: number) =>
      [...table]
        .sort(compareDesc)
        .slice(offset, offset + 5)
        .map(r => r.id);

    const first = offsetPage(0);
    table.push(row("2026-09-25T12:00:00.000000Z"));
    const second = offsetPage(5);

    expect(second).toContain(first[first.length - 1]);
  });
});
