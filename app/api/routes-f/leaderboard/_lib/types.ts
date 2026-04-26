export type Timeframe = "daily" | "weekly" | "monthly" | "all-time";

export interface LeaderboardSeedEntry {
  username: string;
  avatar_url: string;
  seed: number;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  score: number;
  avatar_url: string;
}
