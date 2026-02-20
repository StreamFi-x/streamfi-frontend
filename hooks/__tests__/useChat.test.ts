import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat } from "../useChat";

// Mock SWR globally so tests don't hit the real network
jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
}));

import useSWR from "swr";

const mockMutate = jest.fn();

const makeSwrReturn = (overrides = {}) => ({
  data: [],
  error: undefined,
  isLoading: false,
  mutate: mockMutate,
  ...overrides,
});

describe("useChat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSWR as jest.Mock).mockReturnValue(makeSwrReturn());
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
      // History is always loaded when playbackId exists — isLive only gates polling.
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

    it("polls at 1000ms when stream is live", () => {
      renderHook(() => useChat("playback-abc", "0xWALLET", true));

      expect(useSWR).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({ refreshInterval: 1000 })
      );
    });

    it("returns empty messages array when data is undefined", () => {
      (useSWR as jest.Mock).mockReturnValue(makeSwrReturn({ data: undefined }));

      const { result } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );

      expect(result.current.messages).toEqual([]);
    });

    it("returns messages from SWR data", () => {
      const messages = [
        {
          id: 1,
          username: "Alice",
          message: "hello",
          color: "#9333ea",
          messageType: "message" as const,
          createdAt: new Date().toISOString(),
        },
      ];
      (useSWR as jest.Mock).mockReturnValue(makeSwrReturn({ data: messages }));

      const { result } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );

      expect(result.current.messages).toEqual(messages);
    });

    it("returns isLoading from SWR", () => {
      (useSWR as jest.Mock).mockReturnValue(makeSwrReturn({ isLoading: true }));

      const { result } = renderHook(() =>
        useChat("playback-abc", "0xWALLET", true)
      );

      expect(result.current.isLoading).toBe(true);
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

    it("calls POST /api/streams/chat with correct payload", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ chatMessage: { id: 99 } }),
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

      // mutate should be called with revalidate: true to roll back
      expect(mockMutate).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ revalidate: true })
      );
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
    it("does nothing when wallet is missing", async () => {
      const { result } = renderHook(() => useChat("playback-abc", null, true));

      await act(async () => {
        await result.current.deleteMessage(42);
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
        await result.current.deleteMessage(42);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/streams/chat",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({
            messageId: 42,
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
        await result.current.deleteMessage(42);
      });

      // Should revalidate to restore the optimistically removed message
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
