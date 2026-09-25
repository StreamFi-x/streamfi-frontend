export interface FeaturedStreamEntry {
  position: number;
  creator_id: string;
  creator_username: string;
  stream_id: string;
  stream_title: string;
  category: string;
  viewer_count: number;
  is_live: boolean;
}

export interface FeaturedStreamsResponse {
  featured: FeaturedStreamEntry[];
}
