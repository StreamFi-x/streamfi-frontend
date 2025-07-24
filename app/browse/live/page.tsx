"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import StreamCard from "@/components/shared/profile/StreamCard";
import { languageOptions, sortOptions, liveVideos } from "@/data/browse/live-content";

export default function LivePage() {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSort, setSelectedSort] = useState("recommended");

  const primaryTags = [
    "Games", "IRL", "Shooter", "FPS", "Creative", "Esports", 
    "Arcade", "Racing", "God of war", "NBA", "Football"
  ];

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearAllFilters = () => {
    setSelectedTags([]);
    setSelectedLanguage("all");
    setSearchQuery("");
    setSelectedSort("recommended");
  };

  const filteredVideos = useMemo(() => {
    return liveVideos.filter(video => {
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(tag => video.tags.includes(tag));
      const matchesLanguage = selectedLanguage === "all" || video.language === selectedLanguage;
      const matchesSearch = searchQuery === "" || 
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      return matchesTags && matchesLanguage && matchesSearch;
    });
  }, [selectedTags, selectedLanguage, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Primary Tag Filters - FIRST (directly under Browse title) */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {primaryTags.map((tag) => (
            <Button
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleTag(tag)}
              className={cn(
                "transition-colors px-4 py-2 rounded-md",
                selectedTags.includes(tag)
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
              )}
            >
              {tag}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs Navigation - SECOND (after tag filters) */}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-8">
          <button className="pb-4 px-1 text-sm font-medium text-white border-b-2 border-purple-500">
            Live channels
          </button>
          <button className="pb-4 px-1 text-sm font-medium text-gray-400 hover:text-white">
            Categories
          </button>
        </nav>
      </div>

      {/* Secondary Filters - THIRD (after tabs) */}
      <div className="flex flex-col sm:flex-row gap-6 items-center bg-gray-800/50 p-6 rounded-lg">
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-400 font-medium">Filter by:</span>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-48 bg-gray-700 border-gray-600 text-white">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              {languageOptions.map((option) => (
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 py-3 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-400 font-medium">Sort by:</span>
          <Select value={selectedSort} onValueChange={setSelectedSort}>
            <SelectTrigger className="w-64 bg-gray-700 border-gray-600 text-white">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Video Grid */}
      {filteredVideos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => (
            <StreamCard key={video.id} {...video} />
          ))}
        </div>
      ) : (
        <div className="bg-gray-800 p-16 rounded-lg border border-gray-700 text-center">
          <div className="h-16 w-16 mx-auto mb-6 text-gray-400">
            <Search className="h-full w-full" />
          </div>
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