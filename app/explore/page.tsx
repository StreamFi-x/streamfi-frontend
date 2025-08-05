"use client";

import { useState, useEffect } from "react";
import { FeaturedStream } from "@/components/explore/home/featured-stream";
import { LiveStreams } from "@/components/explore/home/live-streams";
import { TrendingStreams } from "@/components/explore/home/trending-streams";
import { featuredStream } from "@/data/explore/home/featured-stream";
import { liveStreams } from "@/data/explore/home/live-streams";
import { trendingStreams } from "@/data/explore/home/trending-streams";
import SimpleLoader from "@/components/ui/loader/simple-loader";
import { bgClasses, textClasses, combineClasses } from "@/lib/theme-classes";

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
    <div
      className={combineClasses(
        "min-h-screen",
        bgClasses.secondary,
        textClasses.primary,
      )}
    >
      <main className="container mx-auto px-4 py-8">
        <FeaturedStream stream={featuredStream} />

        <LiveStreams title="Live on Streamfi" streams={liveStreams} />

        <TrendingStreams title="Trending in Gaming" streams={trendingStreams} />
      </main>
    </div>
  );
}
