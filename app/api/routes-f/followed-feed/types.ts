export interface CreatorStream {
  creator_id: string;
  username: string;
  title: string;
  category: string;
  viewer_count: number;
  started_at: string;
  ended_at?: string; // present when offline
}

export interface FollowedFeedResponse {
  live: CreatorStream[];
  offline_recently: CreatorStream[];
}
