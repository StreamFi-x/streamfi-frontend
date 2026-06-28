import type { StreakRecord } from "./types";

// Store key: `${viewer_id}:${creator_id}`
export const streakStore: Record<string, StreakRecord> = {
  "viewer_jane:creator_alice": {
    viewer_id: "viewer_jane",
    creator_id: "creator_alice",
    current_streak: 5,
    longest_streak: 12,
    last_check_in: "2026-06-27",
  },
  "viewer_bob:creator_alice": {
    viewer_id: "viewer_bob",
    creator_id: "creator_alice",
    current_streak: 1,
    longest_streak: 3,
    last_check_in: "2026-06-27",
  },
};

export function storeKey(viewer_id: string, creator_id: string): string {
  return `${viewer_id}:${creator_id}`;
}

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Compute date difference in days between two YYYY-MM-DD strings.
 */
export function daysDiff(a: string, b: string): number {
  const msA = new Date(a).getTime();
  const msB = new Date(b).getTime();
  return Math.round(Math.abs(msA - msB) / (1000 * 60 * 60 * 24));
}
