export interface EarnedBadgeRecord {
  badge_id: string;
  viewer_id: string;
  creator_id: string;
  creator_name: string;
  name: string;
  image_url: string;
  earned_at: string;
}

export interface EarnedBadgeEntry {
  badge_id: string;
  creator_id: string;
  creator_name: string;
  name: string;
  image_url: string;
  earned_at: string;
}

export interface MyEarnedBadgesResponse {
  badges: EarnedBadgeEntry[];
}
