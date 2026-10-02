export interface ViewerEvent {
  creator_id: string;
  viewer: string;
  timestamp: number; // Unix timestamp in milliseconds
}

export interface FollowEvent {
  creator_id: string;
  viewer: string;
  timestamp: number; // Unix timestamp in milliseconds
}

export interface ConversionResponse {
  total_viewers: number;
  new_followers: number;
  conversion_percent: number;
}
