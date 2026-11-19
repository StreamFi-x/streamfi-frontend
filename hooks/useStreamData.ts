import { useCallback } from "react";
import useSWR from "swr";
import { useRealtimeChannel } from "./useRealtime";

export interface StreamData {
  streamKey: string;
  rtmpUrl: string | null;
  playbackId: string;
  isLive: boolean;
  currentViewers: number;
  startedAt: string | null;
  totalViews: number;
  peakViewers: number;
  followerCount: number;
}

const fetcher = async (url: string): Promise<StreamData | null> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch");
  }
  const data = await res.json();
  const stream = data.streamData?.stream;
  const user = data.streamData?.user;
  if (!stream) {
    return null;
  }
  return {
    streamKey: stream.streamKey ?? "",
    rtmpUrl: stream.rtmpUrl ?? null,
    playbackId: stream.playbackId ?? "",
    isLive: stream.isLive ?? false,
    currentViewers: stream.currentViewers ?? 0,
    startedAt: stream.startedAt ?? null,
    totalViews: stream.totalViews ?? 0,
    peakViewers: stream.peakViewers ?? 0,
    followerCount: user?.followerCount ?? 0,
  };
};

export function useStreamData(
  wallet: string | undefined,
  enablePush: boolean = true
) {
  const { data, error, isLoading, mutate } = useSWR<StreamData | null>(
    wallet ? `/api/streams/${encodeURIComponent(wallet)}` : null,
    fetcher,
    {
      // With push delivery enabled, relax polling from 5s to 60s background reconciliation
      refreshInterval: enablePush ? 60_000 : 5_000,
      dedupingInterval: 4_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  const playbackId = data?.playbackId;
  const realtimeChannel =
    playbackId && enablePush ? `stream:${playbackId}:presence` : null;

  useRealtimeChannel(
    realtimeChannel,
    useCallback(
      (msg) => {
        if (msg.event === "presence:update" && typeof msg.data?.currentViewers === "number") {
          mutate(
            (curr) =>
              curr
                ? {
                    ...curr,
                    currentViewers: msg.data.currentViewers,
                    peakViewers: Math.max(curr.peakViewers, msg.data.currentViewers),
                  }
                : curr,
            false
          );
        } else if (msg.event === "stream:status" && typeof msg.data?.isLive === "boolean") {
          mutate(
            (curr) =>
              curr
                ? {
                    ...curr,
                    isLive: msg.data.isLive,
                  }
                : curr,
            false
          );
        }
      },
      [mutate]
    )
  );

  return {
    streamData: data,
    isLoading,
    isError: error,
    mutate,
  };
}

