export interface TipRecord {
  id: string;
  creator_id: string;
  tipper: string;
  amount_usdc: number;
  timestamp: number; // Unix timestamp in milliseconds
}

export interface LeaderboardEntry {
  rank: number;
  tipper: string;
  total_usdc: number;
  tip_count: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
}

export type Timeframe = "daily" | "weekly" | "monthly" | "all-time";
