export interface NewCreator {
  id: string;
  name: string;
  wallet_address: string;
  avatar_url: string;
  category: string;
  joined_at: string;
  stream_count: number;
  followers: number;
  is_live: boolean;
}

export interface NewCreatorsFeedQuery {
  within_days: number;
  min_streams: number;
}

export interface NewCreatorsFeedResponse {
  creators: NewCreator[];
  within_days: number;
  min_streams: number;
}
