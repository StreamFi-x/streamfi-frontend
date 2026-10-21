/**
 * hooks/useTypingIndicator.ts
 *
 * Ephemeral typing indicators for stream chat. Outgoing events are throttled
 * and idle-terminated; incoming events live in a TypingTracker whose entries
 * expire on their own. Nothing here touches the persisted chat pipeline.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRealtimeChannel } from "@/hooks/useRealtime";
import type { RealtimeMessage } from "@/lib/realtime/pubsub";
import {
  TYPING_EMIT_INTERVAL_MS,
  TYPING_EVENT,
  TYPING_IDLE_MS,
  TypingTracker,
  formatTypingLabel,
  typingChannel,
  type TypingEventPayload,
  type TypingState,
} from "@/lib/chat-typing";

/** After the server suppresses or rate-limits typing, stay quiet this long. */
export const TYPING_BACKOFF_MS = 30_000;

interface UseTypingIndicatorOptions {
  playbackId: string | null | undefined;
  /** Own wallet — a viewer never sees their own indicator. */
  wallet: string | null | undefined;
  /** False while offline, logged out, or when typing indicators are shed. */
  enabled: boolean;
}

export interface UseTypingIndicatorReturn {
  /** "Alice is typing…" / "3 people are typing…", or null. */
  typingLabel: string | null;
  /** Call on every change of the chat input with its current value. */
  onInputChange: (value: string) => void;
  /** Call right after a message is submitted. */
  onMessageSent: () => void;
}

export function useTypingIndicator({
  playbackId,
  wallet,
  enabled,
}: UseTypingIndicatorOptions): UseTypingIndicatorReturn {
  const tracker = useMemo(() => new TypingTracker(), []);
  const [, setTick] = useState(0);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastEmitAt = useRef(0);
  const isTyping = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quietUntil = useRef(0);

  const ownWallet = wallet?.toLowerCase();
  const active = playbackId && enabled ? playbackId : null;

  // Re-render exactly when the earliest entry expires.
  const scheduleExpiry = useCallback(() => {
    if (expiryTimer.current) {
      clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
    const next = tracker.nextExpiry();
    if (next === null) {
      return;
    }
    expiryTimer.current = setTimeout(
      () => {
        setTick(t => t + 1);
        scheduleExpiry();
      },
      Math.max(0, next - Date.now()) + 1
    );
  }, [tracker]);

  const handleMessage = useCallback(
    (msg: RealtimeMessage) => {
      if (msg.event !== TYPING_EVENT || !msg.data) {
        return;
      }
      const { state, username, wallet: from } = msg.data as TypingEventPayload;
      if (!from || (ownWallet && from.toLowerCase() === ownWallet)) {
        return;
      }
      const key = from.toLowerCase();
      if (state === "typing") {
        tracker.typing(key, username, Date.now());
      } else {
        tracker.stopped(key, Date.now());
      }
      setTick(t => t + 1);
      scheduleExpiry();
    },
    [ownWallet, tracker, scheduleExpiry]
  );

  useRealtimeChannel(active ? typingChannel(active) : null, handleMessage);

  const send = useCallback(
    (state: TypingState) => {
      if (!active) {
        return;
      }
      fetch("/api/streams/chat/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playbackId: active, state }),
      })
        .then(async res => {
          const suppressed =
            res.status === 429 ||
            (res.status === 202 && (await res.json())?.broadcast === false);
          if (suppressed) {
            quietUntil.current = Date.now() + TYPING_BACKOFF_MS;
          }
        })
        .catch(() => {
          // Typing is cosmetic; a failed signal is simply dropped.
        });
    },
    [active]
  );

  const stopTyping = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    if (isTyping.current) {
      isTyping.current = false;
      send("stopped");
    }
  }, [send]);

  const onInputChange = useCallback(
    (value: string) => {
      if (!active) {
        return;
      }
      if (!value.trim()) {
        stopTyping();
        return;
      }

      const now = Date.now();
      if (
        now >= quietUntil.current &&
        now - lastEmitAt.current >= TYPING_EMIT_INTERVAL_MS
      ) {
        lastEmitAt.current = now;
        isTyping.current = true;
        send("typing");
      }

      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
      }
      idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
    },
    [active, send, stopTyping]
  );

  const onMessageSent = useCallback(() => {
    lastEmitAt.current = 0;
    stopTyping();
  }, [stopTyping]);

  // Leaving the stream (or losing eligibility) clears both directions.
  useEffect(() => {
    return () => {
      stopTyping();
      tracker.clear();
      if (expiryTimer.current) {
        clearTimeout(expiryTimer.current);
      }
    };
  }, [active, stopTyping, tracker]);

  return {
    typingLabel: active ? formatTypingLabel(tracker.active(Date.now())) : null,
    onInputChange,
    onMessageSent,
  };
}
