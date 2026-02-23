"use client";

import { useState, useMemo } from "react";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import StreamCard from "@/components/shared/profile/StreamCard";
import { BrowsePageSkeleton } from "@/components/skeletons/skeletons/browsePageSkeleton";
import { EmptyState } from "@/components/skeletons/EmptyState";
import { languageOptions, sortOptions } from "@/data/browse/live-content";

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

export default function LivePage() {
  const { publicKey: address } = useStellarWallet();
  const searchParams = useSearchParams();
  const selectedCategory = searchParams.get("category");
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSort, setSelectedSort] = useState("recommended");

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

  const clearAllFilters = () => {
    setSelectedLanguage("all");
    setSearchQuery("");
    setSelectedSort("recommended");
  };

  // Filter and sort streams
  const processedStreams = useMemo(() => {
    const streams = data?.streams || [];

    // Apply filters
    const filtered = streams.filter(stream => {
      // Category filter from URL params
      const matchesCategory =
        !selectedCategory ||
        stream.category?.toLowerCase() === selectedCategory.toLowerCase() ||
        stream.tags.some(
          tag => tag.toLowerCase() === selectedCategory.toLowerCase()
        );

      // Note: Language filter kept for future implementation
      // Currently no language field in database, so all streams pass
      const matchesLanguage = selectedLanguage === "all";

      const matchesSearch =
        searchQuery === "" ||
        stream.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stream.tags.some(tag =>
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        ) ||
        stream.category?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesLanguage && matchesSearch;
    });

    // Apply sorting
    switch (selectedSort) {
      case "viewers":
        filtered.sort((a, b) => b.viewerCount - a.viewerCount);
        break;
      case "recent":
        filtered.sort(
          (a, b) =>
            new Date(b.streamStartedAt).getTime() -
            new Date(a.streamStartedAt).getTime()
        );
        break;
      case "popular":
        filtered.sort((a, b) => b.totalViews - a.totalViews);
        break;
      case "trending":
        // Trending: combination of recent and high viewer count
        filtered.sort((a, b) => {
          const aScore =
            a.viewerCount * 0.7 +
            (Date.now() - new Date(a.streamStartedAt).getTime()) / 1000000;
          const bScore =
            b.viewerCount * 0.7 +
            (Date.now() - new Date(b.streamStartedAt).getTime()) / 1000000;
          return bScore - aScore;
        });
        break;
      case "recommended":
      default:
        // Recommended: followed first, then by viewer count
        filtered.sort((a, b) => {
          if (a.isFollowing && !b.isFollowing) {
            return -1;
          }
          if (!a.isFollowing && b.isFollowing) {
            return 1;
          }
          return b.viewerCount - a.viewerCount;
        });
        break;
    }

    return filtered;
  }, [
    data?.streams,
    selectedCategory,
    selectedLanguage,
    searchQuery,
    selectedSort,
  ]);

  // Map to StreamCard props
  const mappedStreams = useMemo(
    () =>
      processedStreams.map(stream => ({
        id: stream.id,
        title: stream.title,
        thumbnailUrl: stream.thumbnail || "/placeholder.svg",
        username: stream.username,
        category: stream.category || "General",
        tags: stream.tags,
        viewCount: stream.viewerCount,
        isLive: true,
      })),
    [processedStreams]
  );

  return (
    <div className="space-y-8">
      {/* Secondary Filters */}
      <div className="flex flex-col sm:flex-row gap-6 items-center rounded-lg">
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-400 font-medium">Filter by:</span>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              {languageOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search streams, tags, categories..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 py-3 border-gray-300 placeholder-gray-400"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3 ml-auto">
          <span className="text-sm text-gray-400 font-medium">Sort by:</span>
          <Select value={selectedSort} onValueChange={setSelectedSort}>
            <SelectTrigger className="w-64 border border-gray-200">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && <BrowsePageSkeleton type="live" count={12} />}

      {/* Error State */}
      {error && !isLoading && (
        <EmptyState
          title="Failed to load live streams"
          description="There was an error loading the streams. Please try again."
          icon="video"
          actionLabel="Clear all filters"
          onAction={clearAllFilters}
        />
      )}

      {/* Video Grid */}
      {!isLoading && !error && mappedStreams.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {mappedStreams.map(stream => (
            <StreamCard key={stream.id} {...stream} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && mappedStreams.length === 0 && (
        <EmptyState
          title="No live streams found"
          description="Try adjusting your filters or search terms"
          icon="video"
          actionLabel="Clear all filters"
          onAction={clearAllFilters}
        />
      )}
    </div>
  );
}

