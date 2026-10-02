import type { CreatorStats, CreatorDashboardResponse } from "./types";
import { roundUsdc } from "./currency";

export function buildDashboardResponse(stats: CreatorStats): CreatorDashboardResponse {
  return {
    follower_count: stats.follower_count,
    monthly_recurring_revenue_usdc: roundUsdc(stats.monthly_recurring_revenue_usdc),
    last_stream_at: stats.last_stream_at,
    total_tips_lifetime_usdc: roundUsdc(stats.total_tips_lifetime_usdc),
    active_subs: stats.active_subs,
  };
}
