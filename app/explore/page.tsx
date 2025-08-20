"use client";

import { useState, useEffect } from "react";
import { FeaturedStream } from "@/components/explore/home/FeaturedStream";
import { LiveStreams } from "@/components/explore/home/LiveStreams";
import { TrendingStreams } from "@/components/explore/home/TrendingStreams";
import { featuredStream } from "@/data/explore/home/featured-stream";
import { liveStreams } from "@/data/explore/home/live-streams";
import { trendingStreams } from "@/data/explore/home/trending-streams";
import SimpleLoader from "@/components/ui/loader/simple-loader";

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timeout);
  }, []);

  if (isLoading) {
    return <SimpleLoader />;
  }

  return (
    <div className="min-h-screen bg-secondary text-foreground">
      <main className="container mx-auto px-4 py-8">
        <FeaturedStream stream={featuredStream} />

        <LiveStreams title="Live on Streamfi" streams={liveStreams} />

        <TrendingStreams title="Trending in Gaming" streams={trendingStreams} />
      </main>
    </div>
  );
}
