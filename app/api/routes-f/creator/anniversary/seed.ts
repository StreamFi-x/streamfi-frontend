import type { CreatorStats } from "./types";

const now = Date.now();
const d = 24 * 60 * 60 * 1000;

// Seed creator stats with a variety of ages and milestones
export const creatorStats: CreatorStats[] = [
  {
    creator_id: "creator_a",
    display_name: "AlphaStreamer",
    // Joined exactly 1 year ago + 14 days so upcoming anniversary is in 14 days
    joined_at: now - (365 - 14) * d,
    stream_count: 98,      // near 100th stream
    follower_count: 985,   // near 1000th follower
    last_updated: now,
  },
  {
    creator_id: "creator_b",
    display_name: "BetaCaster",
    // Joined exactly 2 years ago today
    joined_at: now - 730 * d,
    stream_count: 502,
    follower_count: 12000,
    last_updated: now,
  },
  {
    creator_id: "creator_c",
    display_name: "GammaBroadcast",
    // Joined 1 year ago today - anniversary is today
    joined_at: now - 365 * d,
    stream_count: 100, // hits 100th stream today
    follower_count: 1000, // hits 1000th follower today
    last_updated: now,
  },
  {
    creator_id: "creator_d",
    display_name: "DeltaLive",
    // Joined 10 days ago — no anniversaries upcoming in 14-day window
    joined_at: now - 10 * d,
    stream_count: 5,
    follower_count: 45,
    last_updated: now,
  },
];

export function getCreatorStats(creatorId: string): CreatorStats | undefined {
  return creatorStats.find(c => c.creator_id === creatorId);
}
