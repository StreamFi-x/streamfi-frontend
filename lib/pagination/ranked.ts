import { NextResponse } from "next/server";
import {
  CURSOR_VERSION,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PaginationError,
  paginationErrorResponse,
  type Page,
  type PageParamsOptions,
} from "./cursor";

/**
 * Ranked keyset cursor pagination for list endpoints ordered by one or more
 * integer ranking scores descending with a UUID tie-breaker:
 *
 *   ORDER BY score_1 DESC, ..., score_k DESC, id DESC
 *   WHERE (score_1, ..., score_k, id) < ($s1::int, ..., $sk::int, $id::uuid)
 *   LIMIT $limit + 1
 *
 * Shares the same response envelope (`{ items, nextCursor, hasMore }`),
 * parameter validation, and error contract as `lib/pagination/cursor.ts`.
 */

const MAX_CURSOR_LENGTH = 256;
const MAX_INT4 = 2_147_483_647;
const FIRST_PAGE_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RankedKeysetPosition {
  /** Non-negative integer ranking keys in ORDER BY precedence order. */
  scores: number[];
  /** Tie-breaker UUID of the last row seen. */
  id: string;
}

export interface RankedPageParams {
  limit: number;
  after: RankedKeysetPosition | null;
}

export interface RankedPageParamsOptions extends PageParamsOptions {
  /** Number of integer score columns in the endpoint's ORDER BY tuple. */
  scoreCount: number;
}

function isValidScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_INT4
  );
}

export function encodeRankedCursor(position: RankedKeysetPosition): string {
  if (
    position.scores.length === 0 ||
    !position.scores.every(isValidScore) ||
    !UUID_PATTERN.test(position.id)
  ) {
    throw new PaginationError("Invalid cursor");
  }

  return Buffer.from(
    JSON.stringify({
      v: CURSOR_VERSION,
      s: position.scores,
      i: position.id.toLowerCase(),
    })
  ).toString("base64url");
}

export function decodeRankedCursor(
  raw: string,
  scoreCount: number
): RankedKeysetPosition {
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

  const { v, s, i } = parsed as Record<string, unknown>;
  if (
    v !== CURSOR_VERSION ||
    !Array.isArray(s) ||
    s.length !== scoreCount ||
    !s.every(isValidScore) ||
    typeof i !== "string" ||
    !UUID_PATTERN.test(i)
  ) {
    throw new PaginationError("Invalid cursor");
  }

  return { scores: s, id: i.toLowerCase() };
}

export function parseRankedPageParams(
  searchParams: URLSearchParams,
  options: RankedPageParamsOptions
): RankedPageParams {
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
  const after =
    rawCursor === null
      ? null
      : decodeRankedCursor(rawCursor, options.scoreCount);

  return { limit, after };
}

export function readRankedPageParams(
  searchParams: URLSearchParams,
  options: RankedPageParamsOptions
):
  { ok: true; page: RankedPageParams } | { ok: false; response: NextResponse } {
  try {
    return { ok: true, page: parseRankedPageParams(searchParams, options) };
  } catch (error) {
    if (error instanceof PaginationError) {
      return { ok: false, response: paginationErrorResponse(error) };
    }
    throw error;
  }
}

/**
 * Sentinel bounds for the first page: MAX_INT4 for every score column and
 * `ffffffff-ffff-ffff-ffff-ffffffffffff` for the UUID tie-breaker, so every
 * real row sorts strictly after the sentinel in DESC order.
 */
export function rankedKeysetBounds(
  after: RankedKeysetPosition | null,
  scoreCount: number
): RankedKeysetPosition {
  return (
    after ?? {
      scores: Array.from({ length: scoreCount }, () => MAX_INT4),
      id: FIRST_PAGE_ID,
    }
  );
}

/**
 * Builds a cursor-paginated page from rows fetched with `LIMIT limit + 1`.
 */
export function buildRankedPage<R, T>(
  rows: R[],
  limit: number,
  toItem: (row: R) => T,
  getPosition: (row: R) => RankedKeysetPosition
): Page<T> {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];

  return {
    items: pageRows.map(toItem),
    nextCursor: hasMore && last ? encodeRankedCursor(getPosition(last)) : null,
    hasMore,
  };
}
