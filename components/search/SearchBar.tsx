"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { SearchOverlay } from "./SearchOverlay";
import type { SearchResponse } from "./types";
import { getSearchPageHref } from "./utils";

interface SearchBarProps {
  initialQuery?: string;
  placeholder?: string;
  showMobileTrigger?: boolean;
  openOnHotkey?: boolean;
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
}

export function SearchBar({
  initialQuery = "",
  placeholder = "Search creators, streams, and categories",
  showMobileTrigger = false,
  openOnHotkey = true,
  autoFocus = false,
  className = "",
  inputClassName = "",
}: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim());
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDesktopOpen, setIsDesktopOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    setQuery(initialQuery);
    setDebouncedQuery(initialQuery.trim());
  }, [initialQuery]);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }
    inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!openOnHotkey) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (window.innerWidth < 768) {
          setIsMobileOpen(true);
          window.setTimeout(() => mobileInputRef.current?.focus(), 0);
          return;
        }
        inputRef.current?.focus();
        setIsDesktopOpen(true);
      }

      if (event.key === "Escape") {
        setIsDesktopOpen(false);
        setIsMobileOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openOnHotkey]);

  useEffect(() => {
    let active = true;

    if (debouncedQuery.length < 2) {
      setResults(null);
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    setIsLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&type=all&limit=6`)
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
          setResults({ query: debouncedQuery, type: "all", users: [], streams: [], categories: [] });
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
  }, [debouncedQuery]);

  useEffect(() => {
    setIsDesktopOpen(false);
    setIsMobileOpen(false);
  }, [pathname]);

  const overlayOpen = useMemo(() => {
    if (isMobileOpen) {
      return true;
    }
    return isDesktopOpen && (query.trim().length > 0 || isLoading);
  }, [isDesktopOpen, isLoading, isMobileOpen, query]);

  const submitSearch = () => {
    if (!query.trim()) {
      return;
    }
    setIsDesktopOpen(false);
    setIsMobileOpen(false);
    router.push(getSearchPageHref(query));
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitSearch();
    }
    if (event.key === "Escape") {
      setIsDesktopOpen(false);
      setIsMobileOpen(false);
    }
  };

  const inputVisibilityClass = showMobileTrigger ? "hidden md:block" : "block";

  return (
    <>
      <div className={`relative ${className}`}>
        <div className={`relative ${inputVisibilityClass}`}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder={placeholder}
            onChange={event => setQuery(event.target.value)}
            onFocus={() => setIsDesktopOpen(true)}
            onKeyDown={handleInputKeyDown}
            className={`w-full rounded-xl border border-border bg-input py-2 pl-10 pr-20 text-sm text-foreground outline-none ring-0 transition focus:border-highlight ${inputClassName}`}
          />
          <button
            type="button"
            onClick={submitSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-highlight px-2.5 py-1.5 text-xs font-semibold text-background"
          >
            Search
          </button>
        </div>

        {showMobileTrigger && (
          <button
            type="button"
            onClick={() => {
              setIsMobileOpen(true);
              window.setTimeout(() => mobileInputRef.current?.focus(), 0);
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-input text-muted-foreground md:hidden"
            aria-label="Open search"
          >
            <Search className="h-4 w-4" />
          </button>
        )}

        <SearchOverlay
          query={query}
          results={results}
          isLoading={isLoading}
          isOpen={overlayOpen && !isMobileOpen}
          onClose={() => setIsDesktopOpen(false)}
        />
      </div>

      {isMobileOpen && (
        <div className="md:hidden">
          <div className="fixed inset-x-0 top-0 z-[90] border-b border-border bg-background/95 px-4 py-4 backdrop-blur-md">
            <div className="mx-auto flex max-w-3xl items-center gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={mobileInputRef}
                  type="search"
                  value={query}
                  placeholder={placeholder}
                  onChange={event => setQuery(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  className="w-full rounded-xl border border-border bg-input py-3 pl-10 pr-4 text-sm text-foreground outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-input text-muted-foreground"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <SearchOverlay
            query={query}
            results={results}
            isLoading={isLoading}
            isOpen={isMobileOpen}
            fullscreen={true}
            onClose={() => setIsMobileOpen(false)}
          />
        </div>
      )}
    </>
  );
}