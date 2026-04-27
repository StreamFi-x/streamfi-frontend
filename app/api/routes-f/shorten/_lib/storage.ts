import type { UrlEntry } from './types';

// In-memory storage for URL entries
const urlStore = new Map<string, UrlEntry>();

export class UrlStorage {
  /**
   * Store a new URL entry
   */
  static set(code: string, url: string): void {
    const entry: UrlEntry = {
      url,
      hits: 0,
      createdAt: new Date()
    };
    urlStore.set(code, entry);
  }

  /**
   * Retrieve a URL entry by code
   */
  static get(code: string): UrlEntry | undefined {
    return urlStore.get(code);
  }

  /**
   * Increment hit count for a URL entry
   */
  static incrementHits(code: string): UrlEntry | undefined {
    const entry = urlStore.get(code);
    if (entry) {
      entry.hits += 1;
      return entry;
    }
    return undefined;
  }

  /**
   * Check if a code already exists
   */
  static has(code: string): boolean {
    return urlStore.has(code);
  }

  /**
   * Get all entries (useful for testing)
   */
  static getAll(): Map<string, UrlEntry> {
    return new Map(urlStore);
  }

  /**
   * Clear all entries (useful for testing)
   */
  static clear(): void {
    urlStore.clear();
  }

  /**
   * Get the number of stored URLs
   */
  static size(): number {
    return urlStore.size;
  }
}
