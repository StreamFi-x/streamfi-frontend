import type { BadgeDefinition } from "./types";

// Key: creator_id
export const badgeCatalogStore = new Map<string, BadgeDefinition[]>([
  [
    "creator_a",
    [
      {
        badge_id: "badge_founder",
        name: "Founder",
        image_url: "https://cdn.streamfi.io/badges/creator_a/founder.png",
        unlock_rule: "Subscribed within the channel's first 30 days",
      },
      {
        badge_id: "badge_1yr",
        name: "1 Year Supporter",
        image_url: "https://cdn.streamfi.io/badges/creator_a/1yr.png",
        unlock_rule: "Subscribed for 12 consecutive months",
      },
      {
        badge_id: "badge_mod",
        name: "Moderator",
        image_url: "https://cdn.streamfi.io/badges/creator_a/mod.png",
        unlock_rule: "Appointed as a channel moderator",
      },
    ],
  ],
  [
    "creator_b",
    [
      {
        badge_id: "badge_vip",
        name: "VIP",
        image_url: "https://cdn.streamfi.io/badges/creator_b/vip.png",
        unlock_rule: "Granted VIP status by the creator",
      },
    ],
  ],
  // creator_c intentionally has no badges defined yet.
]);

export function getBadgeCatalog(creatorId: string): BadgeDefinition[] {
  return badgeCatalogStore.get(creatorId) ?? [];
}
