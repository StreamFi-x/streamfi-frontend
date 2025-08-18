"use client";
import CategoryCard from "@/components/category/CategoryCard";
import { sortOptions } from "@/data/browse/live-content";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@radix-ui/react-select";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import React, { useEffect, useState } from "react";

type Category = {
  id: string;
  title: string;
  imageUrl?: string;
  viewer?: number;
  tags: string[];
};

export default function BrowseCategoryPage() {
  // const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSort, setSelectedSort] = useState("recommended");

  // const clearAllFilters = () => {
  //   setSelectedLanguage("all");
  //   setSearchQuery("");
  //   setSelectedSort("recommended");
  // };
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/category");
        if (!response.ok) {
          throw new Error("Failed to fetch categories");
        }
        const data = await response.json();
        console.log(data.categories);
        setCategories(data.categories);
      } catch (error) {
        console.error(error);
      }
    };
    fetchCategories();
  }, []);

  // const filteredVideos = useMemo(() => {
  //   return liveVideos.filter(video => {
  //     const matchesLanguage =
  //       selectedLanguage === "all" || video.language === selectedLanguage;
  //     const matchesSearch =
  //       searchQuery === "" ||
  //       video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
  //       video.tags.some(tag =>
  //         tag.toLowerCase().includes(searchQuery.toLowerCase())
  //       );

  //     return matchesLanguage && matchesSearch;
  //   });
  // }, [selectedLanguage, searchQuery]);
  return (
    <div className="">
      <div className="flex flex-col sm:flex-row gap-6 items-center justify-between  rounded-lg">
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

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 py-4 gap-6">
        {categories.map(category => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}
