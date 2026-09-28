/**
 * Server-side search result caching with TTL
 * Designed for autocomplete/prefix queries to reduce redundant lookups
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SearchCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 1000, ttlMs = 10 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Get cached result if valid
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cache entry
   */
  set(key: string, data: T): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [k, v] of this.cache.entries()) {
        if (v.expiresAt < oldestTime) {
          oldestTime = v.expiresAt;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

// Global search cache instance
export const autocompleteCache = new SearchCache(500, 5 * 60 * 1000); // 5 min TTL for autocomplete
export const searchResultsCache = new SearchCache(1000, 10 * 60 * 1000); // 10 min TTL for full search

/**
 * Normalized cache key for search queries
 * Handles case insensitivity and whitespace
 */
export function getCacheKey(query: string, prefix = ''): string {
  return `${prefix}:${query.trim().toLowerCase()}`;
}
