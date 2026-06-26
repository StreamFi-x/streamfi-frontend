import type { StreamRecord } from "./types";

/**
 * Seed creator streams spread across several categories.
 *
 * creator_a streams in gaming, esports and irl with varying viewer/tip levels
 * so the per-category averages are non-trivial. creator_b is a second creator
 * used to confirm filtering by creator_id.
 */
export const streamRecords: StreamRecord[] = [
  { creator_id: "creator_a", stream_id: "s1", category: "gaming", viewers: 100, tips_usdc: 20 },
  { creator_id: "creator_a", stream_id: "s2", category: "gaming", viewers: 200, tips_usdc: 40 },
  { creator_id: "creator_a", stream_id: "s3", category: "gaming", viewers: 300, tips_usdc: 30 },
  { creator_id: "creator_a", stream_id: "s4", category: "esports", viewers: 500, tips_usdc: 100 },
  { creator_id: "creator_a", stream_id: "s5", category: "esports", viewers: 700, tips_usdc: 150 },
  { creator_id: "creator_a", stream_id: "s6", category: "irl", viewers: 80, tips_usdc: 5 },

  { creator_id: "creator_b", stream_id: "s7", category: "music", viewers: 60, tips_usdc: 12 },
  { creator_id: "creator_b", stream_id: "s8", category: "music", viewers: 90, tips_usdc: 18 },
];

export function streamsForCreator(creatorId: string): StreamRecord[] {
  return streamRecords.filter(s => s.creator_id === creatorId);
}
