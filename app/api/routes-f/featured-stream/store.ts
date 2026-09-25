import type { OverrideEntry, FeaturedStream } from "./types";
import { mockCreators } from "./mock-data";

// In-memory store for editorial overrides
export const overrideStore = new Map<string, OverrideEntry>();

// Helper to parse date string to consistent format
export function parseDateString(dateStr: string): Date {
  const date = new Date(dateStr);
  // Normalize to UTC midnight for consistent date comparison
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Helper to get date key (YYYY-MM-DD format)
export function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Get today's date in UTC
export function getTodayDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Deterministic selection based on date
export function getFeaturedByDate(date: Date): FeaturedStream {
  const dateKey = getDateKey(date);
  
  // Convert date to a numeric index using hash of date string
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = ((hash << 5) - hash) + dateKey.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  
  // Use absolute value and modulo to get index
  const index = Math.abs(hash) % mockCreators.length;
  return mockCreators[index];
}

// Get featured stream for a specific date (checking overrides first)
export function getFeaturedStream(date?: string): FeaturedStream {
  const targetDate = date ? parseDateString(date) : getTodayDate();
  const dateKey = getDateKey(targetDate);

  // Check for editorial override
  const override = overrideStore.get(dateKey);
  if (override) {
    // Find the creator in mock data to get full details
    const creator = mockCreators.find(c => c.creator_id === override.creator_id);
    if (creator) {
      return {
        ...creator,
        reason: override.reason,
      };
    }
  }

  // No override, use deterministic selection
  return getFeaturedByDate(targetDate);
}

// Set editorial override
export function setOverride(
  date: string,
  creator_id: string,
  reason: string,
  created_by?: string
): OverrideEntry {
  const parsedDate = parseDateString(date);
  const dateKey = getDateKey(parsedDate);

  // Verify creator exists
  const creatorExists = mockCreators.some(c => c.creator_id === creator_id);
  if (!creatorExists) {
    throw new Error(`Creator with ID ${creator_id} not found in roster`);
  }

  const override: OverrideEntry = {
    date: dateKey,
    creator_id,
    reason,
    created_at: new Date().toISOString(),
    created_by,
  };

  overrideStore.set(dateKey, override);
  return override;
}

// Remove override for a specific date
export function removeOverride(date: string): boolean {
  const parsedDate = parseDateString(date);
  const dateKey = getDateKey(parsedDate);
  return overrideStore.delete(dateKey);
}

// Get all overrides (for debugging/testing)
export function getAllOverrides(): OverrideEntry[] {
  return Array.from(overrideStore.values());
}

// Clear store (for testing)
export function clearOverrideStore(): void {
  overrideStore.clear();
}