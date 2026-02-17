"use client";

import { useAccount } from "@starknet-react/core";
import useSWR from "swr";
import { FeaturedStream } from "@/components/explore/home/FeaturedStream";
import { LiveStreams } from "@/components/explore/home/LiveStreams";
import { TrendingStreams } from "@/components/explore/home/TrendingStreams";
import SimpleLoader from "@/components/ui/loader/simple-loader";

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

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch");
  }
  return res.json();
};

export default function Home() {
  const { address } = useAccount();

  // Fetch live streams with 30-second polling
  const { data, isLoading } = useSWR<{ streams: LiveStream[] }>(
    address
      ? `/api/streams/live?viewer_wallet=${address}`
      : "/api/streams/live",
    fetcher,
    {
      refreshInterval: 30000, // Poll every 30 seconds
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  if (isLoading) {
    return <SimpleLoader />;
  }

  const streams = data?.streams || [];

  // Map API data to component format
  const mappedStreams = streams.map(stream => ({
    id: stream.id,
    title: stream.title,
    thumbnail: stream.thumbnail || "/placeholder.svg",
    viewCount: formatViewCount(stream.viewerCount),
    streamer: {
      name: stream.username,
      username: stream.username,
      logo: stream.avatar || "/placeholder.svg",
    },
    tags: stream.tags,
    location: stream.category || "General",
  }));

  // Featured stream: highest viewer count
  const featuredStreamData = streams[0]
    ? {
        title: streams[0].title,
        thumbnail: streams[0].thumbnail || "/placeholder.svg",
        isLive: true,
        streamerThumbnail: streams[0].avatar || undefined,
        playbackId: streams[0].playbackId,
      }
    : {
        title: "No live streams",
        thumbnail: "/placeholder.svg",
        isLive: false,
      };

  // Trending: top 8 by total views
  const trendingStreams = [...streams]
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 8)
    .map(stream => ({
      id: stream.id,
      title: stream.title,
      thumbnail: stream.thumbnail || "/placeholder.svg",
      viewCount: formatViewCount(stream.totalViews),
      streamer: {
        name: stream.username,
        username: stream.username,
        logo: stream.avatar || "/placeholder.svg",
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
      </main>
    </div>
  );
}

// Helper function to format view counts
function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}
