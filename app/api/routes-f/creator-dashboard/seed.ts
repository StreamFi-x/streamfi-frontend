import type { CreatorStats } from "./types";

export const SEED_STATS: Record<string, CreatorStats> = {
  creator_001: {
    creator_id: "creator_001",
    follower_count: 14_823,
    monthly_recurring_revenue_usdc: 1_247.5,
    last_stream_at: "2026-06-25T20:00:00Z",
    total_tips_lifetime_usdc: 8_934.125,
    active_subs: 312,
  },
  creator_002: {
    creator_id: "creator_002",
    follower_count: 3_210,
    monthly_recurring_revenue_usdc: 198.0,
    last_stream_at: "2026-06-20T15:30:00Z",
    total_tips_lifetime_usdc: 420.5,
    active_subs: 47,
  },
  creator_003: {
    creator_id: "creator_003",
    follower_count: 501,
    monthly_recurring_revenue_usdc: 0.0,
    last_stream_at: null,
    total_tips_lifetime_usdc: 12.333,
    active_subs: 0,
  },
};
