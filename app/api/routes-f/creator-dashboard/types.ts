export interface CreatorStats {
  creator_id: string;
  follower_count: number;
  /** Sum of active subscription amounts in USDC, billed monthly */
  monthly_recurring_revenue_usdc: number;
  last_stream_at: string | null;
  total_tips_lifetime_usdc: number;
  active_subs: number;
}

export interface CreatorDashboardResponse {
  follower_count: number;
  monthly_recurring_revenue_usdc: number;
  last_stream_at: string | null;
  total_tips_lifetime_usdc: number;
  active_subs: number;
}
