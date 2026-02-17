import useSWR from "swr";

interface StreamData {
  streamKey: string;
  rtmpUrl: string;
  playbackId: string;
  isLive: boolean;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch");
  }
  const data = await res.json();
  if (!data.hasStream || !data.streamData) {
    return null;
  }
  return data.streamData;
};

export function useStreamData(wallet: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<StreamData | null>(
    wallet ? `/api/streams/key?wallet=${wallet}` : null,
    fetcher,
    {
      refreshInterval: 10000, // Poll every 10 seconds (reduced from 5)
      dedupingInterval: 5000, // Prevent duplicate requests within 5 seconds
      revalidateOnFocus: false, // Don't refetch on window focus
      revalidateOnReconnect: true, // Refetch on network reconnect
    }
  );

  return {
    streamData: data,
    isLoading,
    isError: error,
    mutate, // Allow manual refresh
  };
}
