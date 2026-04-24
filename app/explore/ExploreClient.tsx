"use client";

import useSWR from "swr";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { getDefaultAvatar } from "@/lib/profile-icons";
import { FeaturedStream } from "@/components/explore/home/FeaturedStream";
import { LiveStreams } from "@/components/explore/home/LiveStreams";
import { TrendingStreams } from "@/components/explore/home/TrendingStreams";
import { PastStreams } from "@/components/explore/home/PastStreams";

interface LiveStream {
  id: string;
  username: string;
  avatar: string | null;
  playbackId: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  thumbnail: string | null;
  viewerCount: number;
  totalViews: number;
  isFollowing: boolean;
  streamStartedAt: string;
}

interface Recording {
  id: string;
  playback_id: string;
  title: string | null;
  duration: number | null;
  created_at: string;
  username: string;
  avatar: string | null;
  stream_date: string | null;
}

function formatViewCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return count.toString();
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) {
    return "";
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch");
  }
  return res.json();
};

export function ExploreClient({
  initialStreams,
}: {
  initialStreams: LiveStream[];
}) {
  const { publicKey: address } = useStellarWallet();

  // SWR starts with server-fetched data immediately (no loading flash).
  // Once wallet connects, refetches with viewer_wallet for personalised sort.
  const { data } = useSWR<{ streams: LiveStream[] }>(
    address
      ? `/api/streams/live?viewer_wallet=${address}`
      : "/api/streams/live",
    fetcher,
    {
      fallbackData: { streams: initialStreams },
      refreshInterval: 30_000,
      revalidateOnFocus: false,
      dedupingInterval: 10_000,
    }
  );

  // Always fetch recordings — used as featured carousel fallback when nobody is live
  const { data: recordingsData } = useSWR<{ recordings: Recording[] }>(
    "/api/streams/recordings",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const streams = data?.streams ?? initialStreams;

  // Mux live snapshot thumbnail (real-time frame from live stream)
  const getMuxThumbnail = (playbackId: string) =>
    `https://image.mux.com/${playbackId}/thumbnail.png?width=640&height=360&fit_mode=crop`;

  const mappedStreams = streams.map(stream => ({
    id: stream.id,
    title: stream.title,
    thumbnail: stream.playbackId
      ? getMuxThumbnail(stream.playbackId)
      : stream.thumbnail || "",
    playbackId: stream.playbackId,
    isLive: true,
    viewCount: formatViewCount(stream.viewerCount),
    streamer: {
      name: stream.username,
      username: stream.username,
      logo: stream.avatar || getDefaultAvatar(stream.username),
    },
    tags: stream.tags,
    location: stream.category || "General",
  }));

  // When nobody is live, map recordings into the same CarouselStream shape
  const recordingCarouselItems = (recordingsData?.recordings ?? []).map(r => ({
    id: r.id,
    title: r.title || "Stream Recording",
    thumbnail: `https://image.mux.com/${r.playback_id}/thumbnail.jpg?time=5`,
    playbackId: r.playback_id,
    isLive: false,
    viewCount: formatDuration(r.duration),
    streamer: {
      name: r.username,
      username: r.username,
      logo: r.avatar || getDefaultAvatar(r.username),
    },
    tags: [] as string[],
    location: "",
  }));

  // Featured carousel: live streams take priority; fall back to past recordings
  const featuredStreams =
    mappedStreams.length > 0 ? mappedStreams : recordingCarouselItems;

  const trendingStreams = [...streams]
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 8)
    .map(stream => ({
      id: stream.id,
      title: stream.title,
      thumbnail: stream.playbackId
        ? getMuxThumbnail(stream.playbackId)
        : stream.thumbnail || "",
      viewCount: formatViewCount(stream.totalViews),
      streamer: {
        name: stream.username,
        username: stream.username,
        logo: stream.avatar || getDefaultAvatar(stream.username),
      },
      tags: stream.tags,
      location: stream.category || "General",
    }));

  return (
    <div className="min-h-screen bg-secondary text-foreground">
      <main className="container mx-auto px-4 py-8">
        <FeaturedStream streams={featuredStreams} />
        <LiveStreams title="Live on Streamfi" streams={mappedStreams} />
        <TrendingStreams title="Trending in Gaming" streams={trendingStreams} />

        <section className="mt-10">
          <h2 className="text-foreground text-xl font-semibold mb-4">
            Past Streams
          </h2>
          <PastStreams />
        </section>
      </main>
    </div>
  );
}
