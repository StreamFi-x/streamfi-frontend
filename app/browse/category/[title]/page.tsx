"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
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
import {
  languageOptions,
  sortOptions,
  liveVideos,
} from "@/data/browse/live-content";
import { cn } from "@/lib/utils";
import { bgClasses, buttonClasses } from "@/lib/theme-classes";

// Mock category data with follower counts
const categoryMockData = {
  "call-of-duty-warzone": {
    id: "1",
    title: "Call of Duty: Warzone",
    description: "Battle royale shooter game with intense multiplayer action",
    thumbnailUrl: "/Images/warzone-category.png",
    followerCount: 2500,
    viewerCount: 507,
    tags: ["Games", "Shooter", "FPS", "Action", "Strategy"],
  },
  games: {
    id: "2",
    title: "Games",
    description: "All gaming content and live streams",
    thumbnailUrl: "/Images/game.png",
    followerCount: 15000,
    viewerCount: 1200,
    tags: ["Games", "Gaming", "Entertainment"],
  },
  cooking: {
    id: "3",
    title: "Cooking",
    description: "Culinary adventures and cooking tutorials",
    thumbnailUrl: "/Images/game.png",
    followerCount: 3200,
    viewerCount: 180,
    tags: ["Cooking", "Food", "Tutorial", "Lifestyle"],
  },
  art: {
    id: "4",
    title: "Art",
    description: "Creative content and digital art streams",
    thumbnailUrl: "/Images/game.png",
    followerCount: 1800,
    viewerCount: 95,
    tags: ["Art", "Creative", "Digital", "Design"],
  },
  fitness: {
    id: "5",
    title: "Fitness",
    description: "Workout sessions and fitness content",
    thumbnailUrl: "/Images/game.png",
    followerCount: 2100,
    viewerCount: 156,
    tags: ["Fitness", "Workout", "Health", "Sports"],
  },
  tech: {
    id: "6",
    title: "Tech",
    description: "Technology reviews and tech talks",
    thumbnailUrl: "/Images/game.png",
    followerCount: 4200,
    viewerCount: 298,
    tags: ["Tech", "Technology", "Review", "Gadgets"],
  },
  music: {
    id: "7",
    title: "Music",
    description: "Music production and live performances",
    thumbnailUrl: "/Images/game.png",
    followerCount: 3800,
    viewerCount: 245,
    tags: ["Music", "Production", "Live", "Creative"],
  },
  travel: {
    id: "8",
    title: "Travel",
    description: "Travel vlogs and destination content",
    thumbnailUrl: "/Images/game.png",
    followerCount: 2900,
    viewerCount: 198,
    tags: ["Travel", "Vlog", "Adventure", "Culture"],
  },
};

// Type for API response
interface CategoryApiResponse {
  success: boolean;
  category: {
    id: string;
    title: string;
    description?: string;
    tags: string[];
    imageUrl?: string;
  };
}

export default function CategoryDetailPage() {
  const params = useParams();
  const title = params.title as string;

  // State for category data
  const [categoryData, setCategoryData] = useState({
    id: "unknown",
    title: decodeURIComponent(title).replace(/-/g, " "),
    description: "Category content and streams",
    thumbnailUrl: "/Images/placeholder.jpg",
    followerCount: 1000,
    viewerCount: 50,
    tags: ["General"],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch category data from API
  useEffect(() => {
    const fetchCategoryData = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/category/${encodeURIComponent(title)}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch category: ${response.status}`);
        }

        const data: CategoryApiResponse = await response.json();

        if (data.success && data.category) {
          // Map API response to our data structure

          setCategoryData({
            id: data.category.id,
            title: data.category.title,
            description:
              data.category.description || "Category content and streams",
            thumbnailUrl:
              data.category.imageUrl &&
              !data.category.imageUrl.includes("example.com")
                ? data.category.imageUrl
                : "/Images/placeholder.jpg",
            // Use mock data for follower/viewer counts since API doesn't provide them
            followerCount: 1000,
            viewerCount: 50,
            tags: data.category.tags || ["General"],
          });
        } else {
          throw new Error("Invalid response format");
        }
      } catch (err) {
        console.error("Error fetching category:", err);

        // Fallback to mock data if available
        const categoryKey = title.toLowerCase().replace(/\s+/g, "-");
        const fallbackData =
          categoryMockData[categoryKey as keyof typeof categoryMockData];
        if (fallbackData) {
          setCategoryData(fallbackData);
        } else {
          setError(
            err instanceof Error ? err.message : "Failed to fetch category"
          );
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryData();
  }, [title]);

  // Tab state
  const [activeTab, setActiveTab] = useState<"live" | "shorts" | "videos">(
    "live"
  );

  // Filter states
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSort, setSelectedSort] = useState("recommended");

  // Tab configuration
  const tabs = [
    { id: "live" as const, name: "Live channels", count: 0 },
    { id: "shorts" as const, name: "Shorts", count: 0 },
    { id: "videos" as const, name: "Videos", count: 0 },
  ];

  // Filter videos by category and tab type
  const filteredVideos = useMemo(() => {
    return liveVideos.filter(video => {
      // Category matching
      const matchesCategory =
        video.category.toLowerCase() === categoryData.title.toLowerCase() ||
        video.tags.some(tag =>
          categoryData.tags.some(categoryTag =>
            tag.toLowerCase().includes(categoryTag.toLowerCase())
          )
        );

      // Language matching
      const matchesLanguage =
        selectedLanguage === "all" || video.language === selectedLanguage;

      // Search matching
      const matchesSearch =
        searchQuery === "" ||
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.tags.some(tag =>
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        );

      // Tab type filtering (for now, treat all as live channels)
      const matchesTab = activeTab === "live" ? video.isLive : true;

      return matchesCategory && matchesLanguage && matchesSearch && matchesTab;
    });
  }, [categoryData, activeTab, selectedLanguage, searchQuery]);

  // Update tab counts
  const tabsWithCounts = tabs.map(tab => ({
    ...tab,
    count:
      tab.id === "live"
        ? filteredVideos.filter(v => v.isLive).length
        : tab.id === "shorts"
          ? 0 // No shorts data yet
          : filteredVideos.length,
  }));

  const clearAllFilters = () => {
    setSelectedLanguage("all");
    setSearchQuery("");
    setSelectedSort("recommended");
  };

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-6 p-6 bg-gradient-to-r from-gray-900 to-gray-800 rounded-lg">
          <div className="w-full sm:w-48 h-48 sm:h-32 bg-gray-700 rounded-lg animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-4">
            <div className="h-8 bg-gray-700 rounded animate-pulse" />
            <div className="h-4 bg-gray-700 rounded animate-pulse w-1/2" />
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-gray-700 rounded-full animate-pulse" />
              <div className="h-6 w-16 bg-gray-700 rounded-full animate-pulse" />
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-20 bg-gray-700 rounded animate-pulse" />
              <div className="h-10 w-10 bg-gray-700 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="text-center text-gray-400">Loading category...</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-900/20 border border-red-700 p-6 rounded-lg text-center">
          <h2 className="text-xl font-semibold text-red-400 mb-2">
            Error Loading Category
          </h2>
          <p className="text-red-300 mb-4">{error}</p>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="border-red-600 text-red-300 hover:bg-red-900/30"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category Hero Section */}
      <div className="flex flex-col sm:flex-row gap-6 p-6 rounded-lg">
        <div className="relative w-full sm:w-48 h-48 sm:h-52 rounded-lg overflow-hidden flex-shrink-0">
          <Image
            src={categoryData.thumbnailUrl}
            alt={categoryData.title}
            fill
            className="object-cover"
            onError={e => {
              (e.target as HTMLImageElement).src = "/Images/placeholder.jpg";
            }}
          />
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            {categoryData.title}
          </h1>

          <div className="flex flex-col sm:flex-row gap-2 text-sm text-white mb-4">
            <span>{categoryData.followerCount.toLocaleString()} followers</span>
            <span>•</span>
            <span>{categoryData.viewerCount} watching</span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {categoryData.tags.map(tag => (
              <span
                key={tag}
                className={`${bgClasses.tag} px-4 py-1 bg-gray-700 text-gray-300 rounded-md text-sm`}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button className={`${buttonClasses.connect}  px-7`}>Follow</Button>
            <Button variant="outline" size="icon" className="bg-[#2E2F30]">
              <ExternalLink className="h-1 w-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-8">
          {tabsWithCounts.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "pb-4 px-1 text-sm font-medium transition-colors relative",
                activeTab === tab.id
                  ? "text-white border-b-2 border-purple-500"
                  : "text-gray-400 hover:text-white"
              )}
            >
              {tab.name}
              {tab.count > 0 && (
                <span className="ml-2 text-xs bg-gray-700 px-2 py-1 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-6 items-center p-0 rounded-lg">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-white font-medium">Filter by:</span>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-48 bg-[#222222] text-white border-none">
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
              placeholder="Search tags"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 py-3 bg-[#181818] border-[#363636] text-white placeholder-gray-400 max-w-xs"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3 ml-auto">
          <span className="text-sm text-white font-medium">Sort by:</span>
          <Select value={selectedSort} onValueChange={setSelectedSort}>
            <SelectTrigger className="w-64 bg-[#222222] text-white border border-none">
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

      {/* Content Grid */}
      {filteredVideos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map(video => (
            <StreamCard key={video.id} {...video} />
          ))}
        </div>
      ) : (
        <div className="bg-gray-800 p-16 rounded-lg border border-gray-700 text-center">
          <div className="h-16 w-16 mx-auto mb-6 text-gray-400">
            <Search className="h-full w-full" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-4">
            No {activeTab === "live" ? "live streams" : activeTab} found
          </h3>
          <p className="text-gray-400 mb-6">
            Try adjusting your filters or search terms
          </p>
          <Button
            onClick={clearAllFilters}
            variant="outline"
            className="border-gray-600 text-gray-300"
          >
            Clear all filters
          </Button>
        </div>
      )}
    </div>
  );
}
