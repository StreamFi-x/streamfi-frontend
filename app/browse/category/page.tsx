"use client";
import CategoryCard from "@/components/category/CategoryCard";
import { BrowsePageSkeleton } from "@/components/skeletons/skeletons/browsePageSkeleton";
import { EmptyState } from "@/components/skeletons/EmptyState";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSort, setSelectedSort] = useState("recommended");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedSort("recommended");
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/category");
        if (!response.ok) {
          throw new Error("Failed to fetch categories");
        }
        const data = await response.json();
        console.log(data.categories);
        setCategories(data.categories || []);
      } catch (error) {
        console.error(error);
        setError(
          error instanceof Error ? error.message : "Failed to fetch categories"
        );
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // Filter categories based on search query
  const filteredCategories = categories.filter(
    category =>
      searchQuery === "" ||
      category.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category?.tags?.some(tag =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  // Show loading state

  // Show error state
  if (error) {
    return (
      <EmptyState
        title="Error Loading Categories"
        description={error}
        icon="users"
        actionLabel="Try Again"
        onAction={() => window.location.reload()}
      />
    );
  }

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
              className="pl-12 pr-4 py-3 border-gray-300   placeholder-gray-400"
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

      {loading && <BrowsePageSkeleton type="categories" count={15} />}

      {/* Categories Grid */}
      {filteredCategories.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 py-4 gap-2">
          {filteredCategories.map(category => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No categories found"
          description={
            searchQuery
              ? "Try adjusting your search terms"
              : "No categories available at the moment"
          }
          icon="gamepad"
          actionLabel="Clear search"
          onAction={clearAllFilters}
          showAction={!!searchQuery}
        />
      )}
    </div>
  );
}
