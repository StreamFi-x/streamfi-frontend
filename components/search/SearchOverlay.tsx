"use client";

import Image from "next/image";
import Link from "next/link";
import { RadioTower, UserRound, Tag, Search as SearchIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchResponse } from "./types";
import {
  getCategoryHref,
  getSearchPageHref,
  getStreamHref,
  getUserHref,
} from "./utils";

interface SearchOverlayProps {
  query: string;
  results: SearchResponse | null;
  isLoading: boolean;
  isOpen: boolean;
  fullscreen?: boolean;
  onClose?: () => void;
}

function SectionHeader(props: {
  icon: React.ReactNode;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between px-1 py-1">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {props.icon}
        <span>{props.title}</span>
      </div>
      <span className="text-xs text-muted-foreground">{props.count}</span>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3 p-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
        >
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SearchOverlay({
  query,
  results,
  isLoading,
  isOpen,
  fullscreen = false,
  onClose,
}: SearchOverlayProps) {
  if (!isOpen) {
    return null;
  }

  const hasResults =
    !!results &&
    (results.streams.length > 0 ||
      results.users.length > 0 ||
      results.categories.length > 0);

  const containerClass = fullscreen
    ? "fixed inset-0 z-[80] bg-background/95 backdrop-blur-md"
    : "absolute top-full left-0 right-0 z-40 mt-2 overflow-hidden rounded-2xl border border-border bg-background shadow-2xl";

  return (
    <div className={containerClass}>
      <div
        className={
          fullscreen
            ? "mx-auto flex h-full max-w-3xl flex-col px-4 pb-6 pt-24"
            : "max-h-[70vh] overflow-y-auto"
        }
      >
        {isLoading ? (
          <LoadingRows />
        ) : !query.trim() ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-4 rounded-full border border-border p-3 text-muted-foreground">
              <SearchIcon className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Search for creators, live streams, or categories
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Type at least 2 characters to start searching.
            </p>
          </div>
        ) : !hasResults ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              No results for &quot;{query}&quot;
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a creator name, stream title, or category tag.
            </p>
          </div>
        ) : (
          <div className="space-y-4 p-3">
            {results.streams.length > 0 && (
              <section className="space-y-2">
                <SectionHeader
                  icon={<RadioTower className="h-3.5 w-3.5" />}
                  title="Live Now"
                  count={results.streams.length}
                />
                {results.streams.map(stream => (
                  <Link
                    key={`stream-${stream.id}`}
                    href={getStreamHref(stream)}
                    className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-3 transition-colors hover:bg-muted/60"
                    onClick={onClose}
                  >
                    <div className="relative h-12 w-12 overflow-hidden rounded-full bg-muted">
                      <Image
                        src={stream.avatar || "/Images/user.png"}
                        alt={stream.username}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {stream.stream_title}
                        </span>
                        <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        @{stream.username} in {stream.category}
                      </p>
                    </div>
                    <span className="rounded-full bg-highlight/10 px-2.5 py-1 text-xs font-medium text-highlight">
                      {stream.current_viewers} watching
                    </span>
                  </Link>
                ))}
              </section>
            )}

            {results.users.length > 0 && (
              <section className="space-y-2">
                <SectionHeader
                  icon={<UserRound className="h-3.5 w-3.5" />}
                  title="Creators"
                  count={results.users.length}
                />
                {results.users.map(user => (
                  <Link
                    key={`user-${user.id}`}
                    href={getUserHref(user)}
                    className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-3 transition-colors hover:bg-muted/60"
                    onClick={onClose}
                  >
                    <div className="relative h-12 w-12 overflow-hidden rounded-full bg-muted">
                      <Image
                        src={user.avatar || "/Images/user.png"}
                        alt={user.username}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          @{user.username}
                        </span>
                        {user.is_live && (
                          <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
                        )}
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {user.bio ||
                          `${user.follower_count.toLocaleString()} followers`}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {user.follower_count.toLocaleString()} followers
                    </span>
                  </Link>
                ))}
              </section>
            )}

            {results.categories.length > 0 && (
              <section className="space-y-2">
                <SectionHeader
                  icon={<Tag className="h-3.5 w-3.5" />}
                  title="Categories"
                  count={results.categories.length}
                />
                {results.categories.map(category => (
                  <Link
                    key={`category-${category.id}`}
                    href={getCategoryHref(category)}
                    className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-3 transition-colors hover:bg-muted/60"
                    onClick={onClose}
                  >
                    <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-muted">
                      <Image
                        src={category.imageurl || "/Images/user.png"}
                        alt={category.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {category.title}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {(category.tags || []).slice(0, 3).join(" • ") ||
                          "Browse category"}
                      </p>
                    </div>
                  </Link>
                ))}
              </section>
            )}
          </div>
        )}

        {query.trim() && (
          <div
            className={
              fullscreen ? "mt-auto pt-4" : "border-t border-border/80 p-3"
            }
          >
            <Link
              href={getSearchPageHref(query)}
              className="flex w-full items-center justify-center rounded-xl bg-highlight px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              onClick={onClose}
            >
              View all results for &quot;{query}&quot;
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
