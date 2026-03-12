"use client";

import useSWR from "swr";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
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

function formatViewCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return count.toString();
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

  const streams = data?.streams ?? initialStreams;

  const mappedStreams = streams.map(stream => ({
    id: stream.id,
    title: stream.title,
    thumbnail: stream.thumbnail || "/Images/user.png",
    viewCount: formatViewCount(stream.viewerCount),
    streamer: {
      name: stream.username,
      username: stream.username,
      logo: stream.avatar || "/Images/user.png",
    },
    tags: stream.tags,
    location: stream.category || "General",
  }));

  const featuredStreamData = streams[0]
    ? {
        title: streams[0].title,
        thumbnail: streams[0].thumbnail || "/Images/user.png",
        isLive: true,
        streamerThumbnail: streams[0].avatar || undefined,
        playbackId: streams[0].playbackId,
      }
    : {
        title: "No live streams",
        thumbnail: "/Images/user.png",
        isLive: false,
      };

  const trendingStreams = [...streams]
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 8)
    .map(stream => ({
      id: stream.id,
      title: stream.title,
      thumbnail: stream.thumbnail || "/Images/user.png",
      viewCount: formatViewCount(stream.totalViews),
      streamer: {
        name: stream.username,
        username: stream.username,
        logo: stream.avatar || "/Images/user.png",
      },
      tags: stream.tags,
      location: stream.category || "General",
    }));

  return (
    <div className="min-h-screen bg-secondary text-foreground">
      <main className="container mx-auto px-4 py-8">
        <FeaturedStream stream={featuredStreamData} />
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
