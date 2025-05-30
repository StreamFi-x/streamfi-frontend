'use client';

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FeaturedStream } from "@/components/explore/home/FeaturedStream";
import { LiveStreams } from "@/components/explore/home/LiveStreams";
import { TrendingStreams } from "@/components/explore/home/TrendingStreams";
import { featuredStream } from "@/data/explore/home/featured-stream";
import { liveStreams } from "@/data/explore/home/live-streams";
import { trendingStreams } from "@/data/explore/home/trending-streams";

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-10"
          >
            <div className="animate-pulse space-y-6">
              <div className="h-8 w-1/3 bg-zinc-800 rounded-md" />
              <div className="h-60 w-full bg-zinc-900 rounded-xl" />
              <div className="h-6 w-1/4 bg-zinc-800 rounded-md mt-6" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array(4)
                  .fill(null)
                  .map((_, i) => (
                    <div key={i} className="h-40 bg-zinc-900 rounded-lg" />
                  ))}
              </div>
              <div className="h-6 w-1/4 bg-zinc-800 rounded-md mt-6" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array(4)
                  .fill(null)
                  .map((_, i) => (
                    <div key={i} className="h-40 bg-zinc-900 rounded-lg" />
                  ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <FeaturedStream stream={featuredStream} />
            <LiveStreams
              title="Live on Streamfi"
              category="gaming"
              streams={liveStreams}
            />
            <TrendingStreams
              title="Trending in Gaming"
              streams={trendingStreams}
            />
          </motion.div>
        )}
      </main>
    </div>
  );
}
