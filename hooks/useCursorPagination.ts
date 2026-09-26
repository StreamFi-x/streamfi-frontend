import { useCallback, useMemo } from "react";
import useSWRInfinite, { type SWRInfiniteConfiguration } from "swr/infinite";

/**
 * Client side of the shared cursor pagination contract (docs/api/pagination.md).
 * Works with any endpoint that returns `{ items, nextCursor, hasMore }`.
 */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export class PageFetchError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export async function fetchPage<P>(url: string): Promise<P> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.error === "string") {
        message = body.error;
      }
    } catch {
      // Non-JSON error body; keep the status message.
    }
    throw new PageFetchError(message, res.status);
  }
  return res.json();
}

/** Appends cursor/limit to a base URL that may already have a query string. */
export function buildPageUrl(
  baseUrl: string,
  cursor: string | null,
  limit?: number
): string {
  const [path, query = ""] = baseUrl.split("?");
  const params = new URLSearchParams(query);
  if (limit !== undefined) {
    params.set("limit", String(limit));
  }
  if (cursor) {
    params.set("cursor", cursor);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export interface UseCursorPaginationOptions<
  T,
  P extends CursorPage<T>,
> extends Omit<SWRInfiniteConfiguration<P>, "fetcher"> {
  limit?: number;
  /** Start from this cursor instead of the head of the list. */
  initialCursor?: string | null;
  /** Stable item identity, used to drop duplicates while pages refresh. */
  getId?: (item: T) => string;
}

/**
 * Paged list with load-more. `baseUrl` null disables fetching.
 *
 * When the first page refreshes and the head of the list has moved, SWR
 * refetches later pages from the new cursors. Until they arrive two pages can
 * briefly hold the same row, so items are de-duplicated by `getId`.
 */
export function useCursorPagination<T, P extends CursorPage<T> = CursorPage<T>>(
  baseUrl: string | null,
  options: UseCursorPaginationOptions<T, P> = {}
) {
  const { limit, initialCursor = null, getId, ...swrOptions } = options;

  const getKey = useCallback(
    (index: number, previous: P | null) => {
      if (!baseUrl) {
        return null;
      }
      if (index === 0) {
        return buildPageUrl(baseUrl, initialCursor, limit);
      }
      if (!previous?.hasMore || !previous.nextCursor) {
        return null;
      }
      return buildPageUrl(baseUrl, previous.nextCursor, limit);
    },
    [baseUrl, initialCursor, limit]
  );

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<P>(getKey, fetchPage<P>, {
      revalidateFirstPage: true,
      ...swrOptions,
    });

  const pages = useMemo(() => data ?? [], [data]);

  const items = useMemo<T[]>(() => {
    const all = pages.flatMap(page => page.items);
    if (!getId) {
      return all;
    }
    const seen = new Set<string>();
    return all.filter(item => {
      const id = getId(item);
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }, [pages, getId]);

  const lastPage = pages[pages.length - 1];
  const hasMore = Boolean(lastPage?.hasMore && lastPage.nextCursor);
  const isLoadingMore = pages.length > 0 && pages.length < size && !error;

  const loadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      void setSize(size + 1);
    }
  }, [hasMore, isLoadingMore, setSize, size]);

  const reset = useCallback(() => setSize(1), [setSize]);

  return {
    items,
    pages,
    hasMore,
    loadMore,
    reset,
    isLoading,
    isLoadingMore,
    isValidating,
    isEmpty: !isLoading && !error && items.length === 0,
    error: error as PageFetchError | Error | undefined,
    mutate,
  };
}
