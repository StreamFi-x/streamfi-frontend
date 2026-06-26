export type CreatorStats = {
  creator_id: string;
  follower_count: number;
  monthly_recurring_revenue_usdc: number;
  last_stream_at: string | null;
  total_tips_lifetime_usdc: number;
  active_subs: number;
};

const SEED: CreatorStats[] = [
  {
    creator_id: "creator_001",
    follower_count: 12500,
    monthly_recurring_revenue_usdc: 1847.5,
    last_stream_at: "2026-06-20T18:00:00.000Z",
    total_tips_lifetime_usdc: 9234.75,
    active_subs: 318,
  },
  {
    creator_id: "creator_002",
    follower_count: 340,
    monthly_recurring_revenue_usdc: 49.99,
    last_stream_at: null,
    total_tips_lifetime_usdc: 12.5,
    active_subs: 8,
  },
];

export function getSeedCreatorStats(creatorId: string): CreatorStats | null {
  return SEED.find((s) => s.creator_id === creatorId) ?? null;
}