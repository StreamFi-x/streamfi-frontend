export interface StreamData {
  id: string;
  title: string;
  creator: string;
  current_viewers: number;
  past_viewers: number; // Viewers at the previous snapshot, for velocity
}

export interface TrendingRankingRow {
  stream_id: string;
  title: string;
  creator: string;
  rank: number;
  score: number;
  viewer_velocity: number;
  computed_at: string;
}
