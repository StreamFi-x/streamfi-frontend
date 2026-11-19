import { useState, useCallback, useRef, useEffect } from 'react';

export interface SearchCacheEntry<T> {
  results: T[];
  timestamp: number;
}

interface UseSearchWithCacheOptions {
  debounceMs?: number;
  cacheTtlMs?: number;
  maxCacheSize?: number;
}

/**
 * Hook for search with client-side caching and debounce
 * Prevents redundant requests and handles out-of-order responses
 */
export function useSearchWithCache<T extends { id: string }>(
  searchFn: (query: string) => Promise<T[]>,
  options: UseSearchWithCacheOptions = {}
) {
  const { debounceMs = 300, cacheTtlMs = 5 * 60 * 1000, maxCacheSize = 50 } = options;

  const [results, setResults] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // In-memory cache keyed by normalized query
  const cacheRef = useRef<Map<string, SearchCacheEntry<T>>>(new Map());
  // Track the latest request to prevent out-of-order responses
  const latestQueryRef = useRef<string>('');
  const requestIdRef = useRef<number>(0);
  // Debounce timeout ID
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Normalize query for consistent cache keys
  const normalizeQuery = useCallback((q: string) => q.trim().toLowerCase(), []);

  // Check if cache entry is still valid
  const isCacheValid = useCallback(
    (entry: SearchCacheEntry<T>) => {
      return Date.now() - entry.timestamp < cacheTtlMs;
    },
    [cacheTtlMs]
  );

  // Evict oldest cache entry if max size exceeded
  const evictOldestIfNeeded = useCallback(() => {
    if (cacheRef.current.size >= maxCacheSize) {
      let oldest: [string, SearchCacheEntry<T>] | null = null;
      for (const entry of cacheRef.current.entries()) {
        if (!oldest || entry[1].timestamp < oldest[1].timestamp) {
          oldest = entry;
        }
      }
      if (oldest) {
        cacheRef.current.delete(oldest[0]);
      }
    }
  }, [maxCacheSize]);

  // Perform search with debounce and caching
  const search = useCallback(
    async (query: string) => {
      const normalizedQuery = normalizeQuery(query);
      latestQueryRef.current = normalizedQuery;
      const currentRequestId = ++requestIdRef.current;

      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Empty query
      if (!normalizedQuery) {
        setResults([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      // Check cache first
      const cacheEntry = cacheRef.current.get(normalizedQuery);
      if (cacheEntry && isCacheValid(cacheEntry)) {
        setResults(cacheEntry.results);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      // Debounce the actual request
      timeoutRef.current = setTimeout(async () => {
        try {
          // Only process if this is still the latest query
          if (latestQueryRef.current !== normalizedQuery || currentRequestId !== requestIdRef.current) {
            return;
          }

          const response = await searchFn(normalizedQuery);

          // Double-check that this response is for the latest query (prevents out-of-order responses)
          if (latestQueryRef.current !== normalizedQuery || currentRequestId !== requestIdRef.current) {
            return;
          }

          // Store in cache
          evictOldestIfNeeded();
          cacheRef.current.set(normalizedQuery, {
            results: response,
            timestamp: Date.now(),
          });

          setResults(response);
          setError(null);
        } catch (err) {
          // Only update error if this is still the latest query
          if (latestQueryRef.current === normalizedQuery && currentRequestId === requestIdRef.current) {
            setError(err instanceof Error ? err : new Error('Search failed'));
            setResults([]);
          }
        } finally {
          if (currentRequestId === requestIdRef.current) {
            setIsLoading(false);
          }
        }
      }, debounceMs);
    },
    [searchFn, normalizeQuery, debounceMs, isCacheValid, evictOldestIfNeeded]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    results,
    isLoading,
    error,
    search,
    clearCache,
    cacheSize: cacheRef.current.size,
  };
}
