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
import StreamCard from "@/components/shared/profile/StreamCard";
import {
  languageOptions,
  sortOptions,
  liveVideos,
} from "@/data/browse/live-content";

export default function LivePage() {
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSort, setSelectedSort] = useState("recommended");

  const clearAllFilters = () => {
    setSelectedLanguage("all");
    setSearchQuery("");
    setSelectedSort("recommended");
  };

  const filteredVideos = useMemo(() => {
    return liveVideos.filter(video => {
      const matchesLanguage =
        selectedLanguage === "all" || video.language === selectedLanguage;
      const matchesSearch =
        searchQuery === "" ||
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.tags.some(tag =>
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        );

      return matchesLanguage && matchesSearch;
    });
  }, [selectedLanguage, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Secondary Filters - FIRST (no tag filters here anymore) */}
      <div className="flex flex-col sm:flex-row gap-6 items-center p-6 rounded-lg">
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-400 font-medium">Filter by:</span>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-48 bg-[#222222] text-white">
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
              className="pl-12 pr-4 py-3 bg-[#181818] border-[#363636] text-white  placeholder-gray-400"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3 ml-auto">
          <span className="text-sm text-gray-400 font-medium">Sort by:</span>
          <Select value={selectedSort} onValueChange={setSelectedSort}>
            <SelectTrigger className="w-64 bg-[#222222] text-white border border-gray-600">
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

      {/* Video Grid */}
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
            No streams found
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
