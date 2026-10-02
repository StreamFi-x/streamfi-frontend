export interface StreamRecord {
  id: string;
  creator_id: string;
  date: string; // ISO date string, e.g. "2026-06-01T00:00:00.000Z"
  viewer_count: number;
  tips_usdc: number;
}

export interface DayPerformance {
  day: string;
  avg_viewers: number;
  avg_tips_usdc: number;
  stream_count: number;
}

export interface DayPerformanceResponse {
  days: DayPerformance[];
}
