import {
  PaginationError,
  parseLimit,
  paginationErrorResponse,
  type Page,
  type PageParamsOptions,
} from "@/lib/pagination/cursor";
import type { NextResponse } from "next/server";

/**
 * Keyset pagination for lists ranked by numeric scores rather than by
 * creation time (live streams by viewers, top users by followers).
 * It shares the envelope, limit rules and error type of ./cursor.
 *
 * Every ranked list is ordered `score_1 DESC, ..., score_n DESC, id DESC`.
 * The cursor holds the scores and id of the last row of the previous page, so
 * the next page is `WHERE (score_1, ..., score_n, id) < (cursor scores, id)`.
 * The id tie-breaker makes the order total.
 */

const RANKED_CURSOR_VERSION = 1;
const MAX_CURSOR_LENGTH = 256;
const MAX_SCORES = 4;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export interface RankedPosition {
  /** Score values of the last row seen, in ORDER BY order. */
  scores: number[];
  /** id (uuid) of the last row seen. */
  id: string;
}

export interface RankedPageParams {
  limit: number;
  after: RankedPosition | null;
}

/** Row shape every ranked keyset query must select. */
export interface RankedRow {
  id: string;
  /** Scores as selected, in ORDER BY order. */
  rank_scores: number[];
}

export function encodeRankedCursor(position: RankedPosition): string {
  return Buffer.from(
    JSON.stringify({
      v: RANKED_CURSOR_VERSION,
      s: position.scores,
      i: position.id,
    })
  ).toString("base64url");
}

export function decodeRankedCursor(
  raw: string,
  scoreCount: number
): RankedPosition {
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
    v !== RANKED_CURSOR_VERSION ||
    !Array.isArray(s) ||
    s.length !== scoreCount ||
    !s.every(n => Number.isSafeInteger(n)) ||
    typeof i !== "string" ||
    !UUID_PATTERN.test(i)
  ) {
    throw new PaginationError("Invalid cursor");
  }

  return { scores: s as number[], id: i.toLowerCase() };
}

/**
 * Parses `limit` and `cursor`. `scoreCount` is the number of ranking columns
 * the endpoint orders by (at most MAX_SCORES); a cursor issued for a different
 * ranking is rejected.
 */
export function parseRankedParams(
  searchParams: URLSearchParams,
  scoreCount: number,
  options: PageParamsOptions = {}
): RankedPageParams {
  if (
    !Number.isInteger(scoreCount) ||
    scoreCount < 1 ||
    scoreCount > MAX_SCORES
  ) {
    throw new RangeError(`scoreCount must be between 1 and ${MAX_SCORES}`);
  }
  const limit = parseLimit(searchParams, options);
  const rawCursor = searchParams.get("cursor");
  const after =
    rawCursor === null ? null : decodeRankedCursor(rawCursor, scoreCount);
  return { limit, after };
}

/** Route-handler variant of parseRankedParams, mirroring readPageParams. */
export function readRankedParams(
  searchParams: URLSearchParams,
  scoreCount: number,
  options: PageParamsOptions = {}
):
  { ok: true; page: RankedPageParams } | { ok: false; response: NextResponse } {
  try {
    return {
      ok: true,
      page: parseRankedParams(searchParams, scoreCount, options),
    };
  } catch (error) {
    if (error instanceof PaginationError) {
      return { ok: false, response: paginationErrorResponse(error) };
    }
    throw error;
  }
}

/**
 * Bind values for the keyset predicate. On the first page `isFirstPage` is
 * true and the query short-circuits on it:
 *
 *   WHERE (${isFirstPage} OR (a, b, id) < (${scores[0]}, ${scores[1]}, ${id}::uuid))
 */
export function rankedBounds(
  after: RankedPosition | null,
  scoreCount: number
): { isFirstPage: boolean; scores: number[]; id: string } {
  if (after === null) {
    return {
      isFirstPage: true,
      scores: new Array<number>(scoreCount).fill(0),
      id: NIL_UUID,
    };
  }
  return { isFirstPage: false, scores: after.scores, id: after.id };
}

/**
 * Builds a page from rows fetched with `LIMIT limit + 1`. The extra row only
 * signals that another page exists; it is never returned.
 */
export function buildRankedPage<R extends RankedRow, T>(
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
        ? encodeRankedCursor({
            scores: last.rank_scores.map(Number),
            id: last.id,
          })
        : null,
    hasMore,
  };
}
