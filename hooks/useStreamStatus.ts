/**
 * hooks/useStreamStatus.ts
 *
 * Subscribes to the stream:<playbackId>:status SSE channel and performs a
 * state-sync fetch on mount / reconnect so clients that open the page after a
 * stream has ended immediately see the correct offline state without waiting
 * for the 5 s poll.
 */

import { useEffect, useState, useCallback } from "react";
import { useRealtimeChannel } from "@/hooks/useRealtime";

export function useStreamStatus(
  playbackId: string | null | undefined,
  initialIsLive: boolean
): { isLive: boolean; endedAt: string | null } {
  const [isLive, setIsLive] = useState<boolean>(initialIsLive);
  const [endedAt, setEndedAt] = useState<string | null>(null);

  // State-sync: fetch the canonical live state on mount and whenever
  // playbackId changes (e.g. viewer arrives after stream already ended).
  useEffect(() => {
    if (!playbackId) return;

    const controller = new AbortController();

    fetch(`/api/streams/playback/${encodeURIComponent(playbackId)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data && typeof data.streamInfo?.isLive === "boolean") {
          setIsLive(data.streamInfo.isLive);
        }
      })
      .catch(() => {
        // Best-effort — a failed sync must never break the watch page.
      });

    return () => controller.abort();
  }, [playbackId]);

  const channel = playbackId ? `stream:${playbackId}:status` : null;

  const onMessage = useCallback(
    (msg: { event: string; data: { endedAt?: string } }) => {
      if (msg.event === "stream:ended") {
        setIsLive(false);
        setEndedAt(msg.data?.endedAt ?? new Date().toISOString());
      }
    },
    []
  );

  useRealtimeChannel(channel, onMessage);

  return { isLive, endedAt };
}
