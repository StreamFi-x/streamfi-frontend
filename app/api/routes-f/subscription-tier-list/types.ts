export interface SubscriptionTier {
  tier_id: string;
  creator_id: string;
  name: string;
  price_usdc: number;
  benefits: string[];
  badge_url: string;
  active: boolean;
}

export interface SubscriptionTierListEntry {
  tier_id: string;
  name: string;
  price_usdc: number;
  benefits: string[];
  badge_url: string;
}

export interface SubscriptionTierListResponse {
  tiers: SubscriptionTierListEntry[];
}
