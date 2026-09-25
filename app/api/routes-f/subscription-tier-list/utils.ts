import type { SubscriptionTier, SubscriptionTierListEntry } from "./types";

export function toListEntry(tier: SubscriptionTier): SubscriptionTierListEntry {
  const { tier_id, name, price_usdc, benefits, badge_url } = tier;
  return { tier_id, name, price_usdc, benefits, badge_url };
}
