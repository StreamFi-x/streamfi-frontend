import type { Redemption, RewardCatalogItem } from "./types";

export function balanceKey(viewerId: string, creatorId: string): string {
  return `${viewerId}:${creatorId}`;
}

export const balances = new Map<string, number>([
  [balanceKey("viewer_1", "creator_a"), 800],
  [balanceKey("viewer_2", "creator_a"), 100],
  [balanceKey("viewer_3", "creator_b"), 2000],
]);

export const rewardCatalog = new Map<string, RewardCatalogItem>([
  [
    "reward_emote",
    { reward_id: "reward_emote", creator_id: "creator_a", name: "Custom Emote", cost: 500 },
  ],
  [
    "reward_shoutout",
    { reward_id: "reward_shoutout", creator_id: "creator_a", name: "Shoutout", cost: 1000 },
  ],
  [
    "reward_song",
    { reward_id: "reward_song", creator_id: "creator_b", name: "Play a Song", cost: 1500 },
  ],
]);

export const redemptionStore = new Map<string, Redemption>();
