import { NextResponse } from "next/server";

/**
 * Shared cursor (keyset) pagination contract for list endpoints.
 * See docs/api/pagination.md for the full contract.
 *
 * Every paginated list is ordered `created_at DESC, id DESC`. The cursor is the
 * (created_at, id) of the last item on the previous page, so the next page is
 * `WHERE (created_at, id) < (cursor.ts, cursor.id)`. The id tie-breaker makes
 * the order total, so rows sharing a timestamp are never skipped or repeated,
 * and rows inserted while a client pages are never shifted into the page it is
 * about to read (the failure mode of OFFSET pagination).
 *
 * Postgres timestamps have microsecond precision but JS Dates only keep
 * milliseconds. Round-tripping a cursor through a Date would move it and skip
 * rows, so queries select the cursor timestamp as text with CURSOR_TS_FORMAT:
 *
 *   to_char(x.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts
 */

export const CURSOR_VERSION = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

const MAX_CURSOR_LENGTH = 256;
const CURSOR_TS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sentinel bounds for the first page: every real row sorts before them. */
const FIRST_PAGE_TS = "infinity";
const FIRST_PAGE_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";

export interface KeysetPosition {
  /** created_at of the last row seen, UTC, microsecond precision. */
  ts: string;
  /** id (uuid) of the last row seen. */
  id: string;
}

export interface PageParams {
  limit: number;
  after: KeysetPosition | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PageParamsOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

/** Row shape every keyset query must select. */
export interface KeysetRow {
  id: string;
  cursor_ts: string;
}

export class PaginationError extends Error {
  readonly status = 400;
}

export function encodeCursor(position: KeysetPosition): string {
  return Buffer.from(
    JSON.stringify({ v: CURSOR_VERSION, t: position.ts, i: position.id })
  ).toString("base64url");
}

export function decodeCursor(raw: string): KeysetPosition {
  if (raw.length === 0 || raw.length > MAX_CURSOR_LENGTH) {
    throw new PaginationError("Invalid cursor");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    throw new PaginationError("Invalid cursor");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new PaginationError("Invalid cursor");
  }
  const { v, t, i } = parsed as Record<string, unknown>;
  if (
    v !== CURSOR_VERSION ||
    typeof t !== "string" ||
    typeof i !== "string" ||
    !isValidCursorTimestamp(t) ||
    !UUID_PATTERN.test(i)
  ) {
    throw new PaginationError("Invalid cursor");
  }

  return { ts: t, id: i.toLowerCase() };
}

/** Rejects calendar-invalid values such as Feb 30, which Date.parse rolls over. */
function isValidCursorTimestamp(ts: string): boolean {
  if (!CURSOR_TS_PATTERN.test(ts)) {
    return false;
  }
  const ms = Date.parse(ts);
  return (
    !Number.isNaN(ms) &&
    new Date(ms).toISOString().slice(0, 19) === ts.slice(0, 19)
  );
}

/**
 * Parses `limit` and `cursor` from a request's query string.
 * - `limit` missing → defaultLimit; above maxLimit → clamped to maxLimit;
 *   non-integer or < 1 → PaginationError.
 * - `cursor` missing → first page; malformed or tampered → PaginationError.
 * - `offset` is rejected so callers of the old contract fail loudly instead of
 *   silently receiving the first page forever.
 */
export function parsePageParams(
  searchParams: URLSearchParams,
  options: PageParamsOptions = {}
): PageParams {
  const maxLimit = options.maxLimit ?? MAX_PAGE_SIZE;
  const defaultLimit = Math.min(
    options.defaultLimit ?? DEFAULT_PAGE_SIZE,
    maxLimit
  );

  if (searchParams.has("offset")) {
    throw new PaginationError(
      "Offset pagination is not supported; use the cursor parameter"
    );
  }

  let limit = defaultLimit;
  const rawLimit = searchParams.get("limit");
  if (rawLimit !== null) {
    if (!/^\d+$/.test(rawLimit)) {
      throw new PaginationError("limit must be a positive integer");
    }
    const parsed = Number(rawLimit);
    if (parsed < 1) {
      throw new PaginationError("limit must be a positive integer");
    }
    limit = Math.min(parsed, maxLimit);
  }

  const rawCursor = searchParams.get("cursor");
  const after = rawCursor === null ? null : decodeCursor(rawCursor);

  return { limit, after };
}

/**
 * Bind values for `(created_at, id) < (${ts}::timestamptz, ${id}::uuid)`.
 * The first page uses sentinels that sort after every row, so one query shape
 * serves every page.
 */
export function keysetBounds(after: KeysetPosition | null): KeysetPosition {
  return after ?? { ts: FIRST_PAGE_TS, id: FIRST_PAGE_ID };
}

/**
 * Builds a page from rows fetched with `LIMIT limit + 1`. The extra row only
 * signals that another page exists; it is never returned.
 */
export function buildPage<R extends KeysetRow, T>(
  rows: R[],
  limit: number,
  toItem: (row: R) => T
): Page<T> {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];

  return {
    items: pageRows.map(toItem),
    nextCursor:
      hasMore && last
        ? encodeCursor({ ts: last.cursor_ts, id: last.id })
        : null,
    hasMore,
  };
}

/** Item mapper for routes that return rows as-is, minus the cursor column. */
export function withoutCursorTs<R extends KeysetRow>({
  cursor_ts: _cursorTs,
  ...item
}: R): Omit<R, "cursor_ts"> {
  return item;
}

export function paginationErrorResponse(error: PaginationError): NextResponse {
  return NextResponse.json({ error: error.message }, { status: error.status });
}

/**
 * parsePageParams for route handlers, in the same shape as verifySession:
 * `{ ok: true, page }`, or `{ ok: false, response }` with a 400 to return.
 */
export function readPageParams(
  searchParams: URLSearchParams,
  options: PageParamsOptions = {}
): { ok: true; page: PageParams } | { ok: false; response: NextResponse } {
  try {
    return { ok: true, page: parsePageParams(searchParams, options) };
  } catch (error) {
    if (error instanceof PaginationError) {
      return { ok: false, response: paginationErrorResponse(error) };
    }
    throw error;
  }
}
