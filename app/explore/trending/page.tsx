"use client";

import React from "react";
import { Eye } from "lucide-react";
import { motion, AnimatePresence, Variants, Easing } from "framer-motion";
import { useRouter } from "next/navigation";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import useSWR from "swr";
import Image from "next/image";

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
    throw new Error("Failed to fetch live streams");
  }
  return res.json();
};

// Calculate trending score based on viewer count and recency
const calculateTrendingScore = (stream: LiveStream): number => {
  const viewerWeight = 0.6;
  const recencyWeight = 0.4;

  // Normalize viewer count (max score of 100)
  const viewerScore = Math.min(stream.viewerCount / 10, 100);

  // Recency score: newer streams get higher scores
  const now = Date.now();
  const streamStart = new Date(stream.streamStartedAt).getTime();
  const ageInHours = (now - streamStart) / (1000 * 60 * 60);
  const recencyScore = Math.max(0, 100 - ageInHours * 5); // Decay over time

  return viewerScore * viewerWeight + recencyScore * recencyWeight;
};

export default function TrendingPage() {
  const router = useRouter();
  const { publicKey: address } = useStellarWallet();

  // Fetch live streams with 20-second polling
  const { data, error, isLoading } = useSWR<{ streams: LiveStream[] }>(
    address
      ? `/api/streams/live?viewer_wallet=${address}`
      : "/api/streams/live",
    fetcher,
    {
      refreshInterval: 20000, // Poll every 20 seconds
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  // Sort streams by trending score
  const trendingStreams = React.useMemo(() => {
    const streams = data?.streams || [];
    return streams
      .map(stream => ({
        ...stream,
        trendingScore: calculateTrendingScore(stream),
      }))
      .sort((a, b) => b.trendingScore - a.trendingScore);
  }, [data?.streams]);

  // Animation variants
  const customEase: Easing = [0.25, 0.46, 0.45, 0.94];

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: {
      opacity: 0,
      y: 20,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: customEase,
      },
    },
  };

  const handleCardClick = (stream: LiveStream) => {
    const urlUsername = stream.username.toLowerCase().replace(/\s+/g, "");
    router.push(`/${urlUsername}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full py-6 px-4">
        <h2 className="text-2xl font-bold mb-6 text-foreground">
          Trending Now
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6 md:gap-y-10">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-card p-2 pb-4 rounded-lg animate-pulse">
              <div className="w-full aspect-video bg-muted rounded-lg mb-2" />
              <div className="flex items-center gap-x-2 mb-2">
                <div className="w-8 h-8 rounded bg-muted" />
                <div className="h-4 bg-muted rounded w-20" />
              </div>
              <div className="h-5 bg-muted rounded w-3/4 mb-2" />
              <div className="flex gap-2">
                <div className="h-6 bg-muted rounded w-16" />
                <div className="h-6 bg-muted rounded w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full py-6 px-4">
        <h2 className="text-2xl font-bold mb-6 text-foreground">
          Trending Now
        </h2>
        <p className="text-muted-foreground">
          Failed to load trending streams.
        </p>
      </div>
    );
  }

  // Empty state
  if (trendingStreams.length === 0) {
    return (
      <div className="w-full py-6 px-4">
        <h2 className="text-2xl font-bold mb-6 text-foreground">
          Trending Now
        </h2>
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            No trending streams at the moment.
          </p>
          <p className="text-muted-foreground text-sm mt-2">
            Check back later to see what&apos;s hot!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-6 px-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2 text-foreground">
          Trending Now
        </h2>
        <p className="text-muted-foreground">
          Hottest streams based on viewer count and recent activity
        </p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6 md:gap-y-10"
      >
        <AnimatePresence mode="wait">
          {trendingStreams.map((stream, index) => (
            <StreamCard
              key={stream.id}
              stream={stream}
              rank={index + 1}
              onClick={() => handleCardClick(stream)}
              itemVariants={itemVariants}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// Stream Card Component
function StreamCard({
  stream,
  rank,
  onClick,
  itemVariants,
}: {
  stream: LiveStream;
  rank: number;
  onClick: () => void;
  itemVariants: Variants;
}) {
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={onClick}
      className="bg-card group cursor-pointer p-2 pb-4 rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-[1.02] relative"
    >
      {/* Trending Rank Badge */}
      {rank <= 3 && (
        <div className="absolute top-4 left-4 z-20 bg-gradient-to-br from-yellow-400 to-orange-500 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center text-sm shadow-lg">
          {rank}
        </div>
      )}

      <div className="relative rounded-lg overflow-hidden">
        {typeof stream.thumbnail === "string" &&
        stream.thumbnail.includes("cloudinary.com") ? (
          <img
            src={stream.thumbnail}
            alt={stream.title}
            className="w-full aspect-video object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <Image
            width={500}
            height={300}
            src={stream.thumbnail || "/placeholder.svg"}
            alt={stream.title}
            className="w-full aspect-video object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}

        <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-0.5 text-sm rounded flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          Live
        </div>

        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-0.5 text-sm rounded flex items-center">
          <Eye className="w-3 h-3 mr-1" />
          {stream.viewerCount}
        </div>
      </div>

      <div className="mt-2 flex flex-col items-start gap-2">
        <div className="flex items-center gap-x-2">
          <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
            {typeof stream.avatar === "string" &&
            stream.avatar.includes("cloudinary.com") ? (
              <img
                src={stream.avatar}
                alt={stream.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <Image
                width={300}
                height={300}
                src={stream.avatar || "/placeholder.svg"}
                alt={stream.username}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <p className="text-sm hover:underline text-muted-foreground">
            {stream.username}
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-opacity-80 transition-opacity text-foreground">
            {stream.title}
          </h3>
          <div className="flex flex-wrap gap-2 mt-1">
            {stream.category && (
              <span className="text-sm px-2 py-0.5 rounded bg-tag text-background">
                {stream.category}
              </span>
            )}
            {stream.tags.slice(0, 2).map((tag, index) => (
              <span
                key={index}
                className="text-sm px-2 py-0.5 rounded bg-tag text-background"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

