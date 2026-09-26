import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import useSWR from "swr";
import type {
  ChatMessage,
  ChatMessageAPI,
  ChatPage,
  UseChatReturn,
} from "@/types/chat";
import {
  reconcileWithRecentWrites,
  recentWritesFor,
  rememberDeleted,
  rememberSent,
} from "@/lib/chat-recent-writes";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import { useRealtimeChannel } from "@/hooks/useRealtime";
import type { RealtimeMessage } from "@/lib/realtime/pubsub";

const MAX_MESSAGES = 200;
const HISTORY_PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 1000;
const PUSH_SYNC_INTERVAL_MS = 30_000;

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
  };
}

interface LiveWindow {
  /** Oldest first, ready to render. */
  messages: ChatMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

const chatFetcher = async (url: string): Promise<LiveWindow> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch chat messages");
  }
  const data: ChatPage = await res.json();
  return {
    // The API returns newest first.
    messages: (data.items ?? []).map(normalizeMessage).reverse(),
    nextCursor: data.nextCursor ?? null,
    hasMore: Boolean(data.hasMore),
  };
};

function dedupeById(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  return messages.filter(m => {
    if (seen.has(m.id)) {
      return false;
    }
    seen.add(m.id);
    return true;
  });
}

/**
 * Chat hook used by all chat components: push delivery (#1450) with SWR
 * polling as the fallback and background sync.
 *
 * The newest MAX_MESSAGES are fetched as the "live window"; pushed messages
 * are appended to it until the next sync. Older history is
 * loaded on demand through the cursor API, starting at the cursor of the live
 * window's oldest message when the reader first asks for it (the anchor), so
 * polling never refetches history pages.
 *
 * While history is open, messages that scroll out of the live window are kept
 * (the "bridge"), so history, bridge and live window stay contiguous as the
 * chat moves. History is only dropped if one poll shares no message with the
 * previous one: more than MAX_MESSAGES arrived between two polls, and the
 * messages in between were never seen.
 *
 * @param playbackId  - Mux playback ID for the stream (null disables fetching)
 * @param wallet      - Connected wallet address (required to send messages)
 * @param isLive      - Whether the stream is currently live (stops polling when false)
 * @param enablePush  - Whether push-based delivery is enabled (feature-flagged)
 */
export function useChat(
  playbackId: string | null | undefined,
  wallet: string | null | undefined,
  isLive: boolean = true,
  enablePush: boolean = true
): UseChatReturn {
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [bridge, setBridge] = useState<ChatMessage[]>([]);
  const previousLive = useRef<ChatMessage[]>([]);
  const optimisticIdCounter = useRef(0);

  // Always fetch history when we have a playbackId — isLive only controls polling.
  // This ensures the fullscreen overlay (and any late-mounting consumer) sees
  // existing messages from the SWR cache immediately, even before detecting live state.
  const cacheKey = playbackId
    ? `/api/streams/chat?playbackId=${playbackId}&limit=${MAX_MESSAGES}`
    : null;
  // With push delivery active, the 1s poll becomes a 30s background sync.
  const shouldPoll = !!playbackId && isLive && !enablePush;

  const { data, error, isLoading, mutate } = useSWR<LiveWindow>(
    cacheKey,
    async (url: string) => {
      const window = await chatFetcher(url);
      return {
        ...window,
        messages: reconcileWithRecentWrites(
          window.messages,
          playbackId ? recentWritesFor(playbackId) : undefined
        ),
      };
    },
    {
      refreshInterval: shouldPoll
        ? POLL_INTERVAL_MS
        : enablePush && isLive
          ? PUSH_SYNC_INTERVAL_MS
          : 0,
      dedupingInterval: 500,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      shouldRetryOnError: false,
    }
  );

  const history = useCursorPagination<ChatMessageAPI>(
    playbackId && anchor ? `/api/streams/chat?playbackId=${playbackId}` : null,
    {
      limit: HISTORY_PAGE_SIZE,
      initialCursor: anchor,
      getId: m => m.id,
      revalidateFirstPage: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  // Realtime push channel subscription (#1450)
  const realtimeChannel =
    playbackId && enablePush ? `stream:${playbackId}:chat` : null;

  useRealtimeChannel(
    realtimeChannel,
    useCallback(
      (realtimeMsg: RealtimeMessage) => {
        if (realtimeMsg.event === "chat:message" && realtimeMsg.data) {
          const incoming = normalizeMessage(realtimeMsg.data as ChatMessageAPI);
          mutate(
            current => {
              const list = current?.messages ?? [];
              if (list.some(m => m.id === incoming.id)) {
                return current;
              }
              // A pushed copy of this client's own pending message replaces it.
              const pendingIndex = list.findIndex(
                m =>
                  m.isPending &&
                  m.message === incoming.message &&
                  (m.wallet === incoming.wallet ||
                    m.username === incoming.username ||
                    m.username === "You")
              );
              const messages =
                pendingIndex === -1
                  ? [...list, incoming]
                  : list.map((m, i) => (i === pendingIndex ? incoming : m));
              return {
                nextCursor: current?.nextCursor ?? null,
                hasMore: current?.hasMore ?? false,
                messages,
              };
            },
            { revalidate: false }
          );
        } else if (
          realtimeMsg.event === "chat:delete" &&
          realtimeMsg.data?.id
        ) {
          const deleteId = String(realtimeMsg.data.id);
          mutate(
            current =>
              current && {
                ...current,
                messages: current.messages.filter(m => m.id !== deleteId),
              },
            { revalidate: false }
          );
          setBridge(current => current.filter(m => m.id !== deleteId));
        }
      },
      [mutate]
    )
  );

  // The window may grow past MAX_MESSAGES between syncs (pushes, own sends).
  // Only the unanchored display is trimmed: trimming the data would drop the
  // message that `nextCursor` points at, and "load older" would then skip it.
  const liveMessages = useMemo(() => data?.messages ?? [], [data]);

  // A new stream or new playback ID starts from a clean history.
  useEffect(() => {
    setAnchor(null);
    setBridge([]);
    previousLive.current = [];
  }, [playbackId]);

  useEffect(() => {
    const previous = previousLive.current;
    previousLive.current = liveMessages;
    if (!anchor || liveMessages.length === 0) {
      return;
    }

    const liveIds = new Set(liveMessages.map(m => m.id));
    if (previous.length > 0 && !previous.some(m => liveIds.has(m.id))) {
      // Nothing in common with the last poll: messages were missed.
      setAnchor(null);
      setBridge([]);
      return;
    }

    // Messages that left the window by scrolling out (older than its oldest
    // entry). Ones that left from inside its range were deleted.
    const oldestLive = Date.parse(liveMessages[0].createdAt);
    const scrolledOut = previous.filter(
      m =>
        !liveIds.has(m.id) &&
        !m.isPending &&
        Date.parse(m.createdAt) <= oldestLive
    );
    if (scrolledOut.length > 0) {
      setBridge(current => dedupeById([...current, ...scrolledOut]));
    }
  }, [anchor, liveMessages]);

  const messages = useMemo(() => {
    if (!anchor) {
      return liveMessages.slice(-MAX_MESSAGES);
    }
    // History pages are newest first; render oldest first.
    const older = history.items.map(normalizeMessage).reverse();
    return dedupeById([...older, ...bridge, ...liveMessages]);
  }, [anchor, bridge, history.items, liveMessages]);

  const hasOlder = anchor ? history.hasMore : Boolean(data?.hasMore);

  const loadOlder = useCallback(() => {
    if (anchor) {
      history.loadMore();
      return;
    }
    if (data?.hasMore && data.nextCursor) {
      setBridge([]);
      setAnchor(data.nextCursor);
    }
  }, [anchor, data, history]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !wallet || !playbackId) {
        return;
      }
      if (content.length > 500) {
        setSendError("Message must be 500 characters or less");
        return;
      }

      setSendError(null);
      setIsSending(true);

      // Optimistic update — add message locally before API confirms
      optimisticIdCounter.current += 1;
      const optimisticId = `pending-${optimisticIdCounter.current}`;
      const optimisticMessage: ChatMessage = {
        id: optimisticId,
        username: "You",
        message: content.trim(),
        color: "#9333ea",
        messageType: "message",
        createdAt: new Date().toISOString(),
        isPending: true,
      };

      // Optimistically update the cache
      await mutate(
        current => ({
          nextCursor: current?.nextCursor ?? null,
          hasMore: current?.hasMore ?? false,
          messages: [...(current?.messages ?? []), optimisticMessage],
        }),
        { revalidate: false }
      );

      try {
        const res = await fetch("/api/streams/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet,
            playbackId,
            content: content.trim(),
            messageType: "message",
          }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to send message");
        }

        // Swap the optimistic entry for the confirmed one. Refetching here
        // could return a shared window that predates this message.
        const { chatMessage } = await res.json();
        const confirmed = normalizeMessage(chatMessage);
        rememberSent(recentWritesFor(playbackId), confirmed);
        await mutate(
          current =>
            current && {
              ...current,
              messages: reconcileWithRecentWrites(
                current.messages.filter(m => m.id !== optimisticId),
                recentWritesFor(playbackId)
              ),
            },
          { revalidate: false }
        );
      } catch (err) {
        // Rollback optimistic update
        await mutate(
          current =>
            current && {
              ...current,
              messages: current.messages.filter(m => m.id !== optimisticId),
            },
          { revalidate: true }
        );
        const errorMessage =
          err instanceof Error ? err.message : "Failed to send message";
        setSendError(errorMessage);
      } finally {
        setIsSending(false);
      }
    },
    [wallet, playbackId, mutate]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!wallet || !playbackId) {
        return;
      }

      // Optimistically remove from UI (live window and any held history)
      await mutate(
        current =>
          current && {
            ...current,
            messages: current.messages.filter(m => m.id !== messageId),
          },
        { revalidate: false }
      );
      setBridge(current => current.filter(m => m.id !== messageId));

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

        rememberDeleted(recentWritesFor(playbackId), messageId);
        if (anchor) {
          await history.mutate();
        }
      } catch {
        // Revalidate to restore the message if delete failed
        await mutate();
      }
    },
    [wallet, playbackId, mutate, anchor, history]
  );

  return {
    messages,
    sendMessage,
    deleteMessage,
    loadOlder,
    hasOlder,
    isLoadingOlder: history.isLoading || history.isLoadingMore,
    isLoading,
    isSending,
    error: error?.message || history.error?.message || sendError,
  };
}
