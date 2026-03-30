"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { SearchBar } from "@/components/search/SearchBar";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchResponse } from "@/components/search/types";
import { getCategoryHref, getStreamHref, getUserHref } from "@/components/search/utils";

type SearchTab = "all" | "users" | "streams" | "categories";

const TABS: Array<{ value: SearchTab; label: string }> = [
  { value: "all", label: "All" },
  { value: "users", label: "Creators" },
  { value: "streams", label: "Live Streams" },
  { value: "categories", label: "Categories" },
];

function LoadingGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border/70 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const activeTab = (searchParams.get("type") as SearchTab | null) ?? "all";
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;

    if (!query.trim()) {
      setResults(null);
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    setIsLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(query.trim())}&type=${encodeURIComponent(activeTab)}&limit=12`)
      .then(async response => {
        if (!response.ok) {
          throw new Error("Search request failed");
        }
        return (await response.json()) as SearchResponse;
      })
      .then(data => {
        if (active) {
          setResults(data);
        }
      })
      .catch(() => {
        if (active) {
          setResults({ query, type: activeTab, users: [], streams: [], categories: [] });
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeTab, query]);

  const empty = useMemo(() => {
    if (!results) {
      return false;
    }
    return (
      results.users.length === 0 &&
      results.streams.length === 0 &&
      results.categories.length === 0
    );
  }, [results]);

  const setTab = (tab: SearchTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") {
      params.delete("type");
    } else {
      params.set("type", tab);
    }
    startTransition(() => {
      router.replace(`/search?${params.toString()}`);
    });
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-[2rem] border border-border/70 bg-gradient-to-br from-background via-muted/30 to-background p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Search</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">Find creators, live streams, and categories</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Search is shareable with the URL, so you can link people directly to what they want to watch.
          </p>
          <div className="mt-6 max-w-3xl">
            <SearchBar
              initialQuery={query}
              placeholder="Search by username, stream title, or category"
              showMobileTrigger={false}
              openOnHotkey={false}
              autoFocus={true}
            />
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setTab(tab.value)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? "bg-highlight text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {!query.trim() ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-lg font-medium text-foreground">Start with a search query</p>
            <p className="mt-2 text-sm text-muted-foreground">Try a creator like alice, a stream title like valorant ranked, or a category like gaming.</p>
          </div>
        ) : isLoading ? (
          <LoadingGrid />
        ) : empty ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-lg font-medium text-foreground">No results for &quot;{query}&quot;</p>
            <p className="mt-2 text-sm text-muted-foreground">Try a broader keyword or switch tabs to narrow the scope.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {results && (activeTab === "all" || activeTab === "streams") && results.streams.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground">Live Now</h2>
                  <span className="text-sm text-muted-foreground">{results.streams.length} results</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {results.streams.map(stream => (
                    <Link key={`stream-${stream.id}`} href={getStreamHref(stream)} className="rounded-2xl border border-border/70 p-4 transition-colors hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="relative h-14 w-14 overflow-hidden rounded-full bg-muted">
                          <Image src={stream.avatar || "/Images/user.png"} alt={stream.username} fill className="object-cover" unoptimized />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate font-semibold text-foreground">{stream.stream_title}</h3>
                            <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
                          </div>
                          <p className="truncate text-sm text-muted-foreground">@{stream.username} in {stream.category}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{stream.tags.join(" • ")}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {results && (activeTab === "all" || activeTab === "users") && results.users.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground">Creators</h2>
                  <span className="text-sm text-muted-foreground">{results.users.length} results</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {results.users.map(user => (
                    <Link key={`user-${user.id}`} href={getUserHref(user)} className="rounded-2xl border border-border/70 p-4 transition-colors hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="relative h-14 w-14 overflow-hidden rounded-full bg-muted">
                          <Image src={user.avatar || "/Images/user.png"} alt={user.username} fill className="object-cover" unoptimized />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate font-semibold text-foreground">@{user.username}</h3>
                            {user.is_live && <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />}
                          </div>
                          <p className="truncate text-sm text-muted-foreground">{user.bio || "No bio yet"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{user.follower_count.toLocaleString()} followers</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {results && (activeTab === "all" || activeTab === "categories") && results.categories.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground">Categories</h2>
                  <span className="text-sm text-muted-foreground">{results.categories.length} results</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {results.categories.map(category => (
                    <Link key={`category-${category.id}`} href={getCategoryHref(category)} className="rounded-2xl border border-border/70 p-4 transition-colors hover:bg-muted/50">
                      <div className="relative mb-3 h-36 overflow-hidden rounded-2xl bg-muted">
                        <Image src={category.imageurl || "/Images/user.png"} alt={category.title} fill className="object-cover" unoptimized />
                      </div>
                      <h3 className="font-semibold text-foreground">{category.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{category.tags.join(" • ")}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}