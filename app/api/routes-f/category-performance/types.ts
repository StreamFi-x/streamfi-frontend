export interface StreamRecord {
  creator_id: string;
  stream_id: string;
  category: string;
  /** Peak / average concurrent viewers for the stream. */
  viewers: number;
  /** Total tips received during the stream, in USDC. */
  tips_usdc: number;
}

export interface CategoryPerformance {
  category: string;
  stream_count: number;
  /** Mean viewers per stream in this category, rounded to 2 decimals. */
  avg_viewers: number;
  /** Mean tips (USDC) per stream in this category, rounded to 2 decimals. */
  avg_tips_usdc: number;
}

export interface CategoryPerformanceResponse {
  categories: CategoryPerformance[];
}
