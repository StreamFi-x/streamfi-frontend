import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat } from "../useChat";

// Mock SWR globally so tests don't hit the real network
jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
}));
// Captures the realtime handler so tests can push messages.
let pushHandler: ((msg: unknown) => void) | undefined;
let pushChannel: string | null | undefined;
jest.mock("@/hooks/useRealtime", () => ({
  useRealtimeChannel: (
    channel: string | null,
    onMessage?: (m: unknown) => void
  ) => {
    pushChannel = channel;
    pushHandler = onMessage;
    return { connectionState: "connected", reconnect: jest.fn() };
  },
}));
jest.mock("swr/infinite", () => ({
  __esModule: true,
  default: jest.fn(),
}));

import useSWR from "swr";
import useSWRInfinite from "swr/infinite";

const mockMutate = jest.fn();
const mockHistoryMutate = jest.fn();
const mockSetSize = jest.fn();

const msg = (n: number) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  username: "Alice",
  message: `m${n}`,
  color: "#9333ea",
  messageType: "message" as const,
  createdAt: `2026-01-01T00:00:${String(n).padStart(2, "0")}.000Z`,
});

const apiMsg = (n: number) => ({
  id: msg(n).id,
  content: `m${n}`,
  messageType: "message" as const,
  createdAt: msg(n).createdAt,
  user: { username: "Alice", wallet: "GABC", avatar: null },
});

/** Live window as the hook's fetcher produces it: oldest first. */
const liveWindow = (ns: number[], extra = {}) => ({
  messages: ns.map(msg),
  nextCursor: null,
  hasMore: false,
  ...extra,
});

const makeSwrReturn = (overrides = {}) => ({
  data: undefined,
  error: undefined,
  isLoading: false,
  mutate: mockMutate,
  ...overrides,
});

const makeInfiniteReturn = (overrides = {}) => ({
  data: undefined,
  error: undefined,
  size: 1,
  setSize: mockSetSize,
  isLoading: false,
  isValidating: false,
  mutate: mockHistoryMutate,
  ...overrides,
});

const lastHistoryKey = () => {
  const calls = (useSWRInfinite as jest.Mock).mock.calls;
  return calls[calls.length - 1][0](0, null);
};

describe("useChat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSWR as jest.Mock).mockReturnValue(makeSwrReturn());
    (useSWRInfinite as jest.Mock).mockReturnValue(makeInfiniteReturn());
    global.fetch = jest.fn();
  });

  describe("fetching behaviour", () => {
    it("passes correct SWR cache key when playbackId and isLive are set", () => {
      renderHook(() => useChat("playback-abc", "0xWALLET", true));

      expect(useSWR).toHaveBeenCalledWith(
        "/api/streams/chat?playbackId=playback-abc&limit=200",
        expect.any(Function),
        expect.any(Object)
      );
    });

    it("passes null SWR key when playbackId is missing", () => {
      renderHook(() => useChat(null, "0xWALLET", true));

      expect(useSWR).toHaveBeenCalledWith(
        null,
        expect.any(Function),
        expect.any(Object)
      );
    });

    it("still fetches history (non-null key) when stream is offline", () => {
      renderHook(() => useChat("playback-abc", "0xWALLET", false));

      expect(useSWR).toHaveBeenCalledWith(
        expect.stringContaining("playback-abc"),
        expect.any(Function),
        expect.any(Object)
      );
    });

    it("disables polling (refreshInterval=0) when stream is offline", () => {
      renderHook(() => useChat("playback-abc", "0xWALLET", false));

      expect(useSWR).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({ refreshInterval: 0 })
      );
    });

    it("polls at 1000ms when stream is live and push is off", () => {
      renderHook(() => useChat("playback-abc", "0xWALLET", true, false));

      expect(useSWR).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({ refreshInterval: 1000 })
      );
      expect(pushChannel).toBeNull();
    });

    it("subscribes to push and syncs every 30s when push is on (default)", () => {
      renderHook(() => useChat("playback-abc", "0xWALLET", true));

      expect(useSWR).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({ refreshInterval: 30_000 })
      );
      expect(pushChannel).toBe("stream:playback-abc:chat");
    });

    it("does not fetch older history until asked", () => {
      renderHook(() => useChat("playback-abc", "0xWALLET", true));

      expect(lastHistoryKey()).toBeNull();
    });

    it("returns empty messages array when data is undefined", () => {
      const { result } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );

      expect(result.current.messages).toEqual([]);
      expect(result.current.hasOlder).toBe(false);
    });

    it("renders the live window oldest first", () => {
      (useSWR as jest.Mock).mockReturnValue(
        makeSwrReturn({ data: liveWindow([1, 2, 3]) })
      );

      const { result } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );

      expect(result.current.messages.map(m => m.message)).toEqual([
        "m1",
        "m2",
        "m3",
      ]);
    });

    it("returns isLoading from SWR", () => {
      (useSWR as jest.Mock).mockReturnValue(makeSwrReturn({ isLoading: true }));

      const { result } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );

      expect(result.current.isLoading).toBe(true);
    });

    it("normalizes API items in the fetcher", async () => {
      renderHook(() => useChat("playback-abc", "0xWALLET", true));
      const fetcher = (useSWR as jest.Mock).mock.calls[0][1];
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [apiMsg(2)],
          nextCursor: "c1",
          hasMore: true,
        }),
      });

      await expect(fetcher("/url")).resolves.toEqual({
        messages: [expect.objectContaining({ id: msg(2).id, message: "m2" })],
        nextCursor: "c1",
        hasMore: true,
      });
    });
  });

  describe("push delivery", () => {
    const pushed = (n: number) => ({ event: "chat:message", data: apiMsg(n) });
    const lastUpdate = () => {
      const calls = mockMutate.mock.calls;
      return calls[calls.length - 1];
    };

    it("appends a pushed message without refetching or trimming the window", () => {
      renderHook(() => useChat("playback-abc", "0xWALLET", true));

      act(() => pushHandler!(pushed(3)));

      const [update, options] = lastUpdate();
      expect(options).toEqual({ revalidate: false });
      // A full 200-message window grows to 201: trimming it would drop the
      // message nextCursor points at, and "load older" would skip it.
      const full = liveWindow(
        Array.from({ length: 200 }, (_, i) => i + 10),
        { nextCursor: "c", hasMore: true }
      );
      const next = update(full);
      expect(next.messages).toHaveLength(201);
      expect(next.messages[200].id).toBe(msg(3).id);
      expect(next.nextCursor).toBe("c");
    });

    it("ignores a pushed message it already has", () => {
      renderHook(() => useChat("playback-abc", "0xWALLET", true));
      act(() => pushHandler!(pushed(1)));

      const current = liveWindow([1]);
      expect(lastUpdate()[0](current)).toBe(current);
    });

    it("replaces this client's pending copy with the pushed message", () => {
      renderHook(() => useChat("playback-abc", "0xWALLET", true));
      act(() => pushHandler!(pushed(5)));

      const next = lastUpdate()[0]({
        ...liveWindow([1]),
        messages: [msg(1), { ...msg(5), id: "pending-1", isPending: true }],
      });
      expect(next.messages.map((m: { id: string }) => m.id)).toEqual([
        msg(1).id,
        msg(5).id,
      ]);
    });

    it("removes a message on a pushed delete", () => {
      renderHook(() => useChat("playback-abc", "0xWALLET", true));
      act(() =>
        pushHandler!({ event: "chat:delete", data: { id: msg(2).id } })
      );

      const next = lastUpdate()[0](liveWindow([1, 2]));
      expect(next.messages.map((m: { id: string }) => m.id)).toEqual([
        msg(1).id,
      ]);
    });
  });

  describe("older history", () => {
    const withOlder = () =>
      (useSWR as jest.Mock).mockReturnValue(
        makeSwrReturn({
          data: liveWindow([2, 3], {
            nextCursor: "live-cursor",
            hasMore: true,
          }),
        })
      );

    it("anchors history at the live window's cursor", () => {
      withOlder();
      const { result } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );
      expect(result.current.hasOlder).toBe(true);

      act(() => result.current.loadOlder());

      expect(lastHistoryKey()).toBe(
        "/api/streams/chat?playbackId=playback-abc&limit=50&cursor=live-cursor"
      );
    });

    it("prepends history pages and continues with loadMore", () => {
      withOlder();
      const { result, rerender } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );
      act(() => result.current.loadOlder());

      (useSWRInfinite as jest.Mock).mockReturnValue(
        makeInfiniteReturn({
          data: [{ items: [apiMsg(1)], nextCursor: "h1", hasMore: true }],
        })
      );
      rerender();

      expect(result.current.messages.map(m => m.message)).toEqual([
        "m1",
        "m2",
        "m3",
      ]);
      expect(result.current.hasOlder).toBe(true);

      act(() => result.current.loadOlder());
      expect(mockSetSize).toHaveBeenCalledWith(2);
    });

    it("drops history only when a poll shares no message with the last one (gap)", () => {
      withOlder();
      const { result, rerender } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );
      act(() => result.current.loadOlder());
      (useSWRInfinite as jest.Mock).mockReturnValue(
        makeInfiniteReturn({
          data: [{ items: [apiMsg(1)], nextCursor: null, hasMore: false }],
        })
      );

      // Message 2 (the anchor) is no longer in the live window.
      (useSWR as jest.Mock).mockReturnValue(
        makeSwrReturn({
          data: liveWindow([4, 5], { nextCursor: "later", hasMore: true }),
        })
      );
      rerender();

      expect(result.current.messages.map(m => m.message)).toEqual(["m4", "m5"]);
      expect(lastHistoryKey()).toBeNull();
    });

    it("keeps history when a new message pushes the oldest out of the window", () => {
      withOlder();
      const { result, rerender } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );
      act(() => result.current.loadOlder());
      (useSWRInfinite as jest.Mock).mockReturnValue(
        makeInfiniteReturn({
          data: [{ items: [apiMsg(1)], nextCursor: "h1", hasMore: true }],
        })
      );
      rerender();

      // One new message: 2 scrolls out of the 200-message window.
      (useSWR as jest.Mock).mockReturnValue(
        makeSwrReturn({
          data: liveWindow([3, 4], { nextCursor: "later", hasMore: true }),
        })
      );
      rerender();

      expect(result.current.messages.map(m => m.message)).toEqual([
        "m1",
        "m2",
        "m3",
        "m4",
      ]);
      expect(lastHistoryKey()).toBe(
        "/api/streams/chat?playbackId=playback-abc&limit=50&cursor=live-cursor"
      );
    });

    it("drops a message deleted inside the live window while history is open", () => {
      (useSWR as jest.Mock).mockReturnValue(
        makeSwrReturn({
          data: liveWindow([2, 3, 4], { nextCursor: "c", hasMore: true }),
        })
      );
      const { result, rerender } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );
      act(() => result.current.loadOlder());

      (useSWR as jest.Mock).mockReturnValue(
        makeSwrReturn({
          data: liveWindow([2, 4], { nextCursor: "c", hasMore: true }),
        })
      );
      rerender();

      expect(result.current.messages.map(m => m.message)).toEqual(["m2", "m4"]);
    });

    it("does nothing when there is no older history", () => {
      (useSWR as jest.Mock).mockReturnValue(
        makeSwrReturn({ data: liveWindow([1]) })
      );
      const { result } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );

      act(() => result.current.loadOlder());

      expect(lastHistoryKey()).toBeNull();
    });
  });

  describe("sendMessage", () => {
    it("does nothing when wallet is missing", async () => {
      const { result } = renderHook(() => useChat("playback-abc", null, true));

      await act(async () => {
        await result.current.sendMessage("hello");
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("does nothing when playbackId is missing", async () => {
      const { result } = renderHook(() => useChat(null, "0xWALLET", true));

      await act(async () => {
        await result.current.sendMessage("hello");
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("does nothing when content is empty/whitespace", async () => {
      const { result } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );

      await act(async () => {
        await result.current.sendMessage("   ");
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("sets sendError and does not call API when message exceeds 500 chars", async () => {
      const { result } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );

      await act(async () => {
        await result.current.sendMessage("a".repeat(501));
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.current.error).toBe(
        "Message must be 500 characters or less"
      );
    });

    it("adds an optimistic message at the head of the live window", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
      mockMutate.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );
      await act(async () => {
        await result.current.sendMessage("hello");
      });

      const next = mockMutate.mock.calls[0][0](liveWindow([1]));
      expect(next.messages[1]).toMatchObject({
        id: "pending-1",
        message: "hello",
        isPending: true,
      });
      expect(next.messages[0].id).toBe(msg(1).id);
    });

    it("swaps the optimistic entry for the confirmed message without refetching", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ chatMessage: apiMsg(8) }),
      });
      mockMutate.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useChat("playback-swap", "0xWALLET", true)
      );
      await act(async () => {
        await result.current.sendMessage("hello");
      });

      const [confirm, options] = mockMutate.mock.calls[1];
      expect(options).toEqual({ revalidate: false });
      const next = confirm({
        ...liveWindow([1]),
        messages: [msg(1), { ...msg(9), id: "pending-1" }],
      });
      expect(next.messages.map((m: { id: string }) => m.id)).toEqual([
        msg(1).id,
        msg(8).id,
      ]);
    });

    it("calls POST /api/streams/chat with correct payload", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ chatMessage: apiMsg(7) }),
      });
      mockMutate.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );

      await act(async () => {
        await result.current.sendMessage("hello world");
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/streams/chat",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet: "0xWALLET",
            playbackId: "playback-abc",
            content: "hello world",
            messageType: "message",
          }),
        })
      );
    });

    it("rolls back optimistic update and sets error on API failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Cannot send message to offline stream" }),
      });
      mockMutate.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );

      await act(async () => {
        await result.current.sendMessage("hello");
      });

      const rollback = mockMutate.mock.calls.find(
        ([, opts]) => opts?.revalidate === true
      );
      expect(rollback).toBeDefined();
      const restored = rollback![0]({
        ...liveWindow([1]),
        messages: [msg(1), { ...msg(9), id: "pending-1" }],
      });
      expect(restored.messages.map((m: { id: string }) => m.id)).toEqual([
        msg(1).id,
      ]);
      expect(result.current.error).toBe(
        "Cannot send message to offline stream"
      );
    });

    it("sets isSending to true during send and false after", async () => {
      let resolveFetch!: (value: unknown) => void;
      const fetchPromise = new Promise(resolve => {
        resolveFetch = resolve;
      });

      (global.fetch as jest.Mock).mockReturnValue(fetchPromise);
      mockMutate.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );

      expect(result.current.isSending).toBe(false);

      act(() => {
        result.current.sendMessage("hello");
      });

      await waitFor(() => expect(result.current.isSending).toBe(true));

      await act(async () => {
        resolveFetch({ ok: true, json: async () => ({}) });
        await fetchPromise;
      });

      await waitFor(() => expect(result.current.isSending).toBe(false));
    });
  });

  describe("deleteMessage", () => {
    const id = msg(4).id;

    it("does nothing when wallet is missing", async () => {
      const { result } = renderHook(() => useChat("playback-abc", null, true));

      await act(async () => {
        await result.current.deleteMessage(id);
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("calls DELETE /api/streams/chat with correct payload", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ message: "deleted" }),
      });
      mockMutate.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );

      await act(async () => {
        await result.current.deleteMessage(id);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/streams/chat",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({
            messageId: id,
            moderatorWallet: "0xWALLET",
          }),
        })
      );
    });

    it("revalidates even on delete failure to restore the message", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Insufficient permissions" }),
      });
      mockMutate.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );

      await act(async () => {
        await result.current.deleteMessage(id);
      });

      expect(mockMutate).toHaveBeenCalledWith();
    });
  });

  describe("error forwarding", () => {
    it("returns SWR error message when fetch fails", () => {
      (useSWR as jest.Mock).mockReturnValue(
        makeSwrReturn({ error: new Error("Network error") })
      );

      const { result } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );

      expect(result.current.error).toBe("Network error");
    });
  });
});
