import { useState, useCallback, useRef } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import type {
  ChatMessage,
  ChatMessageAPI,
  SendChatMessagePayload,
  SendGiftMessagePayload,
  UseChatReturn,
} from "@/types/chat";

const MAX_MESSAGES = 200;
const POLL_INTERVAL_MS = 1000;

/** Deterministic color for a username — same user always gets the same color */
const USER_COLORS = [
  "#9333ea", // purple
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#3b82f6", // blue
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f43f5e", // rose
  "#a855f7", // fuchsia
];

/** djb2 hash — better distribution than simple charCode accumulation */
function getUserColor(username: string): string {
  let hash = 5381;
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) + hash) ^ username.charCodeAt(i);
    hash = hash >>> 0; // keep as unsigned 32-bit
  }
  return USER_COLORS[hash % USER_COLORS.length];
}

/** Map an API message to the normalized ChatMessage shape */
function normalizeMessage(msg: ChatMessageAPI): ChatMessage {
  return {
    id: msg.id,
    username: msg.user.username,
    message: msg.content,
    color: getUserColor(msg.user.username),
    avatar: msg.user.avatar,
    wallet: msg.user.wallet,
    messageType: msg.messageType,
    createdAt: msg.createdAt,
    metadata: msg.metadata ?? null,
  };
}

const chatFetcher = async (url: string): Promise<ChatMessage[]> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch chat messages");
  }
  const data = await res.json();
  const messages: ChatMessageAPI[] = data.messages || [];
  return messages.map(normalizeMessage);
};

/**
 * SWR-based chat hook used by all chat components.
 *
 * @param playbackId  - Mux playback ID for the stream (null disables fetching)
 * @param wallet      - Connected wallet address (required to send messages)
 * @param isLive         - Whether the stream is currently live (stops polling when false)
 * @param enablePolling  - When false, loads history once without refresh interval (e.g. chat panel hidden)
 */
export function useChat(
  playbackId: string | null | undefined,
  wallet: string | null | undefined,
  isLive: boolean = true,
  enablePolling: boolean = true
): UseChatReturn {
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const optimisticIdCounter = useRef(-1);

  // Always fetch history when we have a playbackId — isLive only controls polling.
  // This ensures the fullscreen overlay (and any late-mounting consumer) sees
  // existing messages from the SWR cache immediately, even before detecting live state.
  const cacheKey = playbackId
    ? `/api/streams/chat?playbackId=${playbackId}&limit=${MAX_MESSAGES}`
    : null;
  const shouldPoll = !!playbackId && isLive && enablePolling;

  const { data, error, isLoading, mutate } = useSWR<ChatMessage[]>(
    cacheKey,
    chatFetcher,
    {
      refreshInterval: shouldPoll ? POLL_INTERVAL_MS : 0,
      dedupingInterval: 500,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      shouldRetryOnError: false,
    }
  );

  const messages = data ? data.slice(-MAX_MESSAGES) : [];

  const sendChatPayload = useCallback(
    async (payload: SendChatMessagePayload) => {
      if (!payload.content.trim() || !payload.wallet || !payload.playbackId) {
        return;
      }
      if (payload.content.length > 500) {
        setSendError("Message must be 500 characters or less");
        return;
      }

      setSendError(null);
      setIsSending(true);

      const optimisticId = optimisticIdCounter.current--;
      const optimisticMessage: ChatMessage = {
        id: optimisticId,
        username: "You",
        message: payload.content.trim(),
        color: "#9333ea",
        messageType: payload.messageType ?? "message",
        createdAt: new Date().toISOString(),
        metadata: payload.metadata ?? null,
        isPending: true,
      };

      await mutate(
        current => {
          const updated = [...(current || []), optimisticMessage];
          return updated.slice(-MAX_MESSAGES);
        },
        { revalidate: false }
      );

      try {
        const res = await fetch("/api/streams/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            content: payload.content.trim(),
          }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to send message");
        }

        await mutate();
      } catch (err) {
        await mutate(
          current => (current || []).filter(m => m.id !== optimisticId),
          { revalidate: true }
        );
        const errorMessage =
          err instanceof Error ? err.message : "Failed to send message";
        setSendError(errorMessage);
      } finally {
        setIsSending(false);
      }
    },
    [mutate]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      await sendChatPayload({
        wallet: wallet as SendChatMessagePayload["wallet"],
        playbackId: playbackId ?? "",
        content,
        messageType: "message",
      });
    },
    [playbackId, sendChatPayload, wallet]
  );

  const sendGiftMessage = useCallback(
    async (payload: SendGiftMessagePayload) => {
      await sendChatPayload({
        ...payload,
        messageType: "gift",
      });
    },
    [sendChatPayload]
  );

  const deleteMessage = useCallback(
    async (messageId: number) => {
      if (!wallet) {
        return;
      }

      // Optimistically remove from UI
      await mutate(current => (current || []).filter(m => m.id !== messageId), {
        revalidate: false,
      });

      try {
        const res = await fetch("/api/streams/chat", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId,
            moderatorWallet: wallet,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to delete message");
        }

        await mutate();
      } catch {
        // Revalidate to restore the message if delete failed
        await mutate();
      }
    },
    [wallet, mutate]
  );

  const banUser = useCallback(
    async (username: string, durationMinutes?: number) => {
      void username;
      void durationMinutes;
      toast.message("User timeouts and bans are not available yet.");
    },
    []
  );

  return {
    messages,
    sendMessage,
    sendGiftMessage,
    deleteMessage,
    banUser,
    isLoading,
    isSending,
    error: error?.message || sendError,
  };
}
