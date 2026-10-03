import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import {
  buildPageUrl,
  useCursorPagination,
  PageFetchError,
} from "../useCursorPagination";

// Real SWR with an isolated cache per test; only fetch is mocked.
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);

interface Item {
  id: string;
}

function respondWith(pages: Record<string, unknown>) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    const body = pages[url];
    if (!body) {
      return Promise.resolve({
        ok: false,
        status: 400,
        json: async () => ({ error: "Invalid cursor" }),
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => body });
  });
}

beforeEach(() => {
  global.fetch = jest.fn();
});

describe("buildPageUrl", () => {
  it("adds limit and cursor, preserving an existing query string", () => {
    expect(buildPageUrl("/api/x?username=a b", "c1", 20)).toBe(
      "/api/x?username=a+b&limit=20&cursor=c1"
    );
    expect(buildPageUrl("/api/x", null)).toBe("/api/x");
  });
});

describe("useCursorPagination", () => {
  it("loads the first page, then follows nextCursor until hasMore is false", async () => {
    respondWith({
      "/api/items?limit=2": {
        items: [{ id: "4" }, { id: "3" }],
        nextCursor: "c3",
        hasMore: true,
      },
      "/api/items?limit=2&cursor=c3": {
        items: [{ id: "2" }, { id: "1" }],
        nextCursor: null,
        hasMore: false,
      },
    });

    const { result } = renderHook(
      () => useCursorPagination<Item>("/api/items", { limit: 2 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toHaveLength(4));

    expect(result.current.items.map(i => i.id)).toEqual(["4", "3", "2", "1"]);
    expect(result.current.hasMore).toBe(false);

    // Further loadMore calls are no-ops at the end of the list.
    const fetchesAtEnd = (global.fetch as jest.Mock).mock.calls.length;
    act(() => result.current.loadMore());
    expect(global.fetch).toHaveBeenCalledTimes(fetchesAtEnd);
    expect(
      (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
        url.includes("cursor=c3")
      )
    ).toHaveLength(1);
  });

  it("sends credentials so authenticated lists work", async () => {
    respondWith({
      "/api/items": { items: [], nextCursor: null, hasMore: false },
    });

    renderHook(() => useCursorPagination<Item>("/api/items"), { wrapper });

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/items", {
        credentials: "include",
      })
    );
  });

  it("reports an empty list", async () => {
    respondWith({
      "/api/items": { items: [], nextCursor: null, hasMore: false },
    });

    const { result } = renderHook(
      () => useCursorPagination<Item>("/api/items"),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isEmpty).toBe(true));
    expect(result.current.hasMore).toBe(false);
  });

  it("starts from initialCursor when given", async () => {
    respondWith({
      "/api/items?cursor=anchor": {
        items: [{ id: "1" }],
        nextCursor: null,
        hasMore: false,
      },
    });

    const { result } = renderHook(
      () =>
        useCursorPagination<Item>("/api/items", { initialCursor: "anchor" }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.items).toEqual([{ id: "1" }]));
  });

  it("does not fetch when the URL is null", () => {
    renderHook(() => useCursorPagination<Item>(null), { wrapper });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("surfaces the API error message", async () => {
    respondWith({});

    const { result } = renderHook(
      () => useCursorPagination<Item>("/api/items"),
      { wrapper }
    );

    await waitFor(() =>
      expect(result.current.error).toBeInstanceOf(PageFetchError)
    );
    expect(result.current.error?.message).toBe("Invalid cursor");
    expect((result.current.error as PageFetchError).status).toBe(400);
  });

  it("drops duplicate items across pages when getId is given", async () => {
    respondWith({
      "/api/items": {
        items: [{ id: "2" }, { id: "1" }],
        nextCursor: "c",
        hasMore: true,
      },
      "/api/items?cursor=c": {
        items: [{ id: "1" }, { id: "0" }],
        nextCursor: null,
        hasMore: false,
      },
    });

    const { result } = renderHook(
      () => useCursorPagination<Item>("/api/items", { getId: i => i.id }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    act(() => result.current.loadMore());

    await waitFor(() =>
      expect(result.current.items.map(i => i.id)).toEqual(["2", "1", "0"])
    );
  });
});
