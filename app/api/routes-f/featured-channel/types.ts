export interface FeaturedCreator {
  id: string;
  name: string;
  wallet_address: string;
  avatar_url: string;
  category: string;
  followers: number;
  is_live: boolean;
  weight: number;
}

export interface FeaturedChannelResponse {
  featured_creator: FeaturedCreator;
  rotation_id: string;
  rotates_at: string;
}

export interface NextRotationResponse {
  rotation_id: string;
  rotates_at: string;
}
