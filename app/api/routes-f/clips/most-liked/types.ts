export type Timeframe = "24h" | "7d" | "30d" | "all-time";

export interface ClipRecord {
  clip_id: string;
  creator_id: string;
  title: string;
  duration_seconds: number;
  likes: number;
  created_at: number; // epoch ms
  thumbnail_url: string;
  vod_id: string;
}

export interface RankedClip extends ClipRecord {
  rank: number;
}

export interface MostLikedResponse {
  clips: RankedClip[];
  timeframe: Timeframe;
  total: number;
}
