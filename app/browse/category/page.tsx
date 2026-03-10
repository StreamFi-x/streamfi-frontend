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
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";

type Category = {
  id: string;
  title: string;
  imageUrl?: string;
  viewers?: number;
  tags: string[];
};

export default function BrowseCategoryPage() {
  const searchParams = useSearchParams();
  const selectedCategory = searchParams.get("category");
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
        if (!response.ok) {throw new Error("Failed to fetch categories");}
        const data = await response.json();
        // API returns lowercase `imageurl` — normalize to `imageUrl` for CategoryCard.
        // Filter out example.com placeholder URLs that aren't real images.
        setCategories(
          (data.categories || []).map((c: Record<string, unknown>) => {
            const raw = c.imageurl as string | undefined;
            return {
              ...c,
              imageUrl:
                raw && !raw.includes("example.com") ? raw : undefined,
            };
          })
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch categories"
        );
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const filteredCategories = categories.filter(category => {
    const matchesCategory =
      !selectedCategory ||
      category.title.toLowerCase() === selectedCategory.toLowerCase() ||
      category.tags?.some(
        tag => tag.toLowerCase() === selectedCategory.toLowerCase()
      );

    const matchesSearch =
      searchQuery === "" ||
      category.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.tags?.some(tag =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );

    return matchesCategory && matchesSearch;
  });

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
    <div className="space-y-4">
      {/* Search + Sort — stacked on mobile, inline on sm+ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 pr-4"
          />
        </div>

        <div className="flex items-center gap-2 sm:shrink-0">
          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
            Sort by
          </span>
          <Select value={selectedSort} onValueChange={setSelectedSort}>
            <SelectTrigger className="w-full sm:w-52">
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

      {!loading && filteredCategories.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {filteredCategories.map(category => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      )}

      {!loading && filteredCategories.length === 0 && (
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
