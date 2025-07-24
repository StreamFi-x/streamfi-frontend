"use client";

import { useState, useMemo } from "react";
import { Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { liveTags, languageOptions, sortOptions, liveVideos, type VideoCard } from "@/data/browse/live-content";
import StreamCard from "@/components/shared/profile/StreamCard";
import { cn } from "@/lib/utils";

export default function LivePage() {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [selectedSort, setSelectedSort] = useState("recommended");

  // Primary tags that match the design
  const primaryTags = [
    "Games", "IRL", "Shooter", "FPS", "Creative", "Esports", 
    "Arcade", "Racing", "God of war", "NBA", "Football"
  ];

  // Filter videos based on selected criteria
  const filteredVideos = useMemo(() => {
    return liveVideos.filter((video) => {
      // Tag filter
      if (selectedTags.length > 0) {
        const hasMatchingTag = selectedTags.some(tag => 
          video.tags.includes(tag)
        );
        if (!hasMatchingTag) return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          video.title.toLowerCase().includes(query) ||
          video.username.toLowerCase().includes(query) ||
          video.category.toLowerCase().includes(query) ||
          video.tags.some(tag => tag.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Language filter
      if (selectedLanguage !== "all" && video.language !== selectedLanguage) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort videos
      switch (selectedSort) {
        case "recommended":
          // For demo, we'll use view count as recommendation
          return b.viewCount - a.viewCount;
        case "viewers":
          return b.viewCount - a.viewCount;
        case "recent":
          return parseInt(b.id) - parseInt(a.id);
        case "popular":
          return b.viewCount - a.viewCount;
        case "trending":
          return (b.viewCount * 0.7 + parseInt(b.id) * 0.3) - (a.viewCount * 0.7 + parseInt(a.id) * 0.3);
        default:
          return 0;
      }
    });
  }, [selectedTags, searchQuery, selectedLanguage, selectedSort]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearAllFilters = () => {
    setSelectedTags([]);
    setSearchQuery("");
    setSelectedLanguage("all");
    setSelectedSort("recommended");
  };

  return (
    <div className="space-y-8">
      {/* Primary Tag Filters */}
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3">
          {primaryTags.map((tag) => (
            <Button
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleTag(tag)}
              className={cn(
                "transition-colors",
                selectedTags.includes(tag)
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700"
              )}
            >
              {tag}
            </Button>
          ))}
        </div>
      </div>

      {/* Secondary Filters */}
      <div className="flex flex-col sm:flex-row gap-6 items-center">
        {/* Language Filter */}
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-400">Filter by:</span>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {languageOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-white hover:bg-gray-700">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search Tags */}
        <div className="flex-1 max-w-lg">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search tags"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
            />
          </div>
        </div>

        {/* Sort Filter */}
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-400">Sort by:</span>
          <Select value={selectedSort} onValueChange={setSelectedSort}>
            <SelectTrigger className="w-56 bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="recommended" className="text-white hover:bg-gray-700">
                Recommended for You
              </SelectItem>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-white hover:bg-gray-700">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Video Grid */}
      {filteredVideos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredVideos.map((video) => (
            <StreamCard key={video.id} {...video} />
          ))}
        </div>
      ) : (
        <div className="bg-gray-800 p-16 rounded-lg border border-gray-700 text-center">
          <Filter className="h-16 w-16 mx-auto mb-6 text-gray-400" />
          <h3 className="text-xl font-semibold text-white mb-4">
            No streams found
          </h3>
          <p className="text-gray-400 mb-6">
            Try adjusting your filters or search terms
          </p>
          <Button onClick={clearAllFilters} variant="outline" className="border-gray-600 text-gray-300">
            Clear all filters
          </Button>
        </div>
      )}
    </div>
  );
} 