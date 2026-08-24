import type { SubscriptionTier } from "./types";

// Deterministic seed tiers, including a retired (inactive) tier per creator
// to exercise active-only filtering.
export const subscriptionTierStore: SubscriptionTier[] = [
  {
    tier_id: "tier_alpha_basic",
    creator_id: "creator-alpha",
    name: "Basic",
    price_usdc: 5,
    benefits: ["Ad-free viewing", "Subscriber badge"],
    badge_url: "https://cdn.streamfi.xyz/badges/creator-alpha/basic.png",
    active: true,
  },
  {
    tier_id: "tier_alpha_premium",
    creator_id: "creator-alpha",
    name: "Premium",
    price_usdc: 15,
    benefits: [
      "Ad-free viewing",
      "Subscriber badge",
      "Custom emotes",
      "Priority chat color",
    ],
    badge_url: "https://cdn.streamfi.xyz/badges/creator-alpha/premium.png",
    active: true,
  },
  {
    tier_id: "tier_alpha_legacy",
    creator_id: "creator-alpha",
    name: "Legacy VIP",
    price_usdc: 25,
    benefits: ["Ad-free viewing", "Legacy badge"],
    badge_url: "https://cdn.streamfi.xyz/badges/creator-alpha/legacy.png",
    active: false,
  },
  {
    tier_id: "tier_beta_basic",
    creator_id: "creator-beta",
    name: "Supporter",
    price_usdc: 8,
    benefits: ["Ad-free viewing", "Subscriber badge"],
    badge_url: "https://cdn.streamfi.xyz/badges/creator-beta/supporter.png",
    active: true,
  },
];

export function getActiveTiersForCreator(
  creatorId: string
): SubscriptionTier[] {
  return subscriptionTierStore.filter(
    t => t.creator_id === creatorId && t.active
  );
}
