import useSWR from "swr";

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

export function useStreamData(wallet: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<StreamData | null>(
    wallet ? `/api/streams/${encodeURIComponent(wallet)}` : null,
    fetcher,
    {
      refreshInterval: 5_000, // poll every 5s for live viewer count
      dedupingInterval: 4_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  return {
    streamData: data,
    isLoading,
    isError: error,
    mutate,
  };
}
