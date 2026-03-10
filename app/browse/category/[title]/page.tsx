"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import useSWR from "swr";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ExternalLink } from "lucide-react";
import StreamCard from "@/components/shared/profile/StreamCard";
import { EmptyState } from "@/components/skeletons/EmptyState";
import { languageOptions, sortOptions } from "@/data/browse/live-content";
import { cn } from "@/lib/utils";

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

interface CategoryData {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  tags: string[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch");
  }
  return res.json();
};

function CategoryHeroSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row gap-6 rounded-lg">
        <div className="w-full sm:w-48 h-48 sm:h-52 bg-muted rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-3 py-2">
          <div className="h-7 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="flex gap-2 pt-1">
            <div className="h-6 w-16 bg-muted rounded-full" />
            <div className="h-6 w-16 bg-muted rounded-full" />
          </div>
          <div className="flex gap-2 pt-2">
            <div className="h-9 w-24 bg-muted rounded" />
            <div className="h-9 w-9 bg-muted rounded" />
          </div>
        </div>
      </div>
      <div className="border-b border-border">
        <div className="flex space-x-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="pb-4 px-1">
              <div className="h-5 w-24 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CategoryDetailPage() {
  const params = useParams();
  const title = params.title as string;
  const { publicKey: address } = useStellarWallet();

  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch live streams with 20-second polling
  const { data } = useSWR<{ streams: LiveStream[] }>(
    address
      ? `/api/streams/live?viewer_wallet=${address}`
      : "/api/streams/live",
    fetcher,
    { refreshInterval: 20000, revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  // Fetch category metadata from DB
  useEffect(() => {
    const fetchCategory = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/category/${encodeURIComponent(title)}`);
        if (!res.ok) {
          throw new Error("Not found");
        }
        const json = await res.json();
        if (!json.success || !json.category) {
          throw new Error("Invalid response");
        }
        const c = json.category;
        setCategoryData({
          id: c.id,
          title: c.title,
          description: c.description || "",
          // API returns lowercase `imageurl`
          thumbnailUrl:
            c.imageurl && !c.imageurl.includes("example.com")
              ? c.imageurl
              : "/Images/placeholder.jpg",
          tags: c.tags || [],
        });
      } catch {
        // Graceful fallback: derive title from URL slug, no image
        setCategoryData({
          id: "unknown",
          title: decodeURIComponent(title).replace(/-/g, " "),
          description: "",
          thumbnailUrl: "/Images/placeholder.jpg",
          tags: [],
        });
      } finally {
        setLoading(false);
      }
    };
    fetchCategory();
  }, [title]);

  const [activeTab, setActiveTab] = useState<"live" | "shorts" | "videos">(
    "live"
  );
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSort, setSelectedSort] = useState("recommended");

  const tabs = [
    { id: "live" as const, name: "Live channels" },
    { id: "shorts" as const, name: "Shorts" },
    { id: "videos" as const, name: "Videos" },
  ];

  const categoryFilteredStreams = useMemo(() => {
    if (!categoryData) {
      return [];
    }
    const streams = data?.streams || [];
    return streams.filter(stream => {
      const matchesCategory =
        stream.category?.toLowerCase() === categoryData.title.toLowerCase() ||
        stream.tags.some(tag =>
          categoryData.tags.some(ct =>
            tag.toLowerCase().includes(ct.toLowerCase())
          )
        ) ||
        categoryData.title
          .toLowerCase()
          .includes(stream.category?.toLowerCase() || "");

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
  }, [data?.streams, categoryData, selectedLanguage, searchQuery]);

  const filteredStreams = useMemo(
    () => (activeTab === "live" ? categoryFilteredStreams : []),
    [categoryFilteredStreams, activeTab]
  );

  const mappedStreams = useMemo(
    () =>
      filteredStreams.map(stream => ({
        id: stream.id,
        title: stream.title,
        thumbnailUrl: stream.thumbnail || "/Images/user.png",
        username: stream.username,
        category: stream.category || "General",
        tags: stream.tags,
        viewCount: stream.viewerCount,
        isLive: true,
      })),
    [filteredStreams]
  );

  const totalViewerCount = useMemo(
    () => categoryFilteredStreams.reduce((sum, s) => sum + s.viewerCount, 0),
    [categoryFilteredStreams]
  );

  const clearAllFilters = () => {
    setSelectedLanguage("all");
    setSearchQuery("");
    setSelectedSort("recommended");
  };

  if (loading) {
    return <CategoryHeroSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Category Hero */}
      <div className="flex flex-col sm:flex-row gap-6 rounded-lg">
        <div className="relative w-full sm:w-48 h-48 sm:h-52 rounded-lg overflow-hidden flex-shrink-0">
          <Image
            src={categoryData?.thumbnailUrl || "/Images/placeholder.jpg"}
            alt={categoryData?.title || "Category"}
            fill
            className="object-cover"
            onError={e => {
              (e.target as HTMLImageElement).src = "/Images/placeholder.jpg";
            }}
          />
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <h1 className="text-2xl font-bold mb-2 capitalize">
            {categoryData?.title}
          </h1>

          {categoryData?.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {categoryData.description}
            </p>
          )}

          <p className="text-sm text-muted-foreground mb-4">
            {totalViewerCount.toLocaleString()} watching now
          </p>

          {categoryData?.tags && categoryData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {categoryData.tags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-muted text-muted-foreground rounded-md text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <Button className="px-7">Follow</Button>
            <Button variant="outline" size="icon">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "pb-4 px-1 text-sm font-medium transition-colors relative",
                activeTab === tab.id
                  ? "text-foreground border-b-2 border-highlight"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.name}
              {tab.id === "live" && categoryFilteredStreams.length > 0 && (
                <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">
                  {categoryFilteredStreams.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters — same layout as browse/live */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search streams, tags, categories..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 pr-4"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:gap-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-xs text-muted-foreground font-medium sm:whitespace-nowrap">
              Filter by
            </span>
            <Select
              value={selectedLanguage}
              onValueChange={setSelectedLanguage}
            >
              <SelectTrigger className="w-full sm:w-44">
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

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2 sm:ml-auto">
            <span className="text-xs text-muted-foreground font-medium sm:whitespace-nowrap">
              Sort by
            </span>
            <Select value={selectedSort} onValueChange={setSelectedSort}>
              <SelectTrigger className="w-full sm:w-56">
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
      </div>

      {/* Content Grid */}
      {mappedStreams.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {mappedStreams.map(stream => (
            <StreamCard key={stream.id} {...stream} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={`No ${activeTab === "live" ? "live streams" : activeTab} found`}
          description={
            activeTab === "live"
              ? "No live streams in this category right now. Try adjusting your filters or check back later."
              : "This feature is coming soon!"
          }
          icon={activeTab === "live" ? "video" : "search"}
          actionLabel={activeTab === "live" ? "Clear all filters" : undefined}
          onAction={activeTab === "live" ? clearAllFilters : undefined}
        />
      )}
    </div>
  );
}
