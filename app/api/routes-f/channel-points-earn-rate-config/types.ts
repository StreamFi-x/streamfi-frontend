export interface EarnRateConfig {
  creator_id: string;
  points_per_minute_watched: number;
  points_per_chat_message: number;
  updated_at: string;
}

export interface EarnRateConfigUpdateBody {
  creator_id: string;
  points_per_minute_watched?: number;
  points_per_chat_message?: number;
}
