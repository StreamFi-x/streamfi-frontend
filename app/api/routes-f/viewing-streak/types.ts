export interface StreakRecord {
  viewer_id: string;
  creator_id: string;
  current_streak: number;
  longest_streak: number;
  last_check_in: string; // ISO date string YYYY-MM-DD
}

export interface CheckInRequest {
  viewer_id: string;
  creator_id: string;
  on_date?: string; // optional override, defaults to today
}

export interface CheckInResponse {
  current_streak: number;
  longest_streak: number;
  last_check_in: string;
  message: string;
}
