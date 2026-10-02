export interface FeaturedStream {
  creator_id: string;
  creator_username: string;
  creator_display_name: string;
  stream_id: string;
  stream_title: string;
  reason: string;
  category: string;
  thumbnail_url?: string;
  viewer_count: number;
  is_live: boolean;
}

export interface OverrideRequest {
  date: string; // ISO format YYYY-MM-DD
  creator_id: string;
  reason: string;
}

export interface OverrideEntry extends OverrideRequest {
  created_at: string;
  created_by?: string;
}

export interface GetFeaturedStreamRequest {
  date?: string; // ISO format YYYY-MM-DD
}

export interface GetFeaturedStreamResponse {
  featured: FeaturedStream;
  date: string;
  is_override: boolean;
}