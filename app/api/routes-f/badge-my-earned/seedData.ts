import type { EarnedBadgeRecord } from "./types";

// Deterministic seed — fixed earned_at timestamps so most-recent-first
// ordering is stable regardless of when the test runs.
export const earnedBadgeStore: EarnedBadgeRecord[] = [
  {
    badge_id: "badge_founder",
    viewer_id: "viewer_1",
    creator_id: "creator_a",
    creator_name: "AlphaStreams",
    name: "Founder",
    image_url: "https://cdn.streamfi.io/badges/creator_a/founder.png",
    earned_at: "2026-01-05T00:00:00.000Z",
  },
  {
    badge_id: "badge_vip",
    viewer_id: "viewer_1",
    creator_id: "creator_b",
    creator_name: "BetaGaming",
    name: "VIP",
    image_url: "https://cdn.streamfi.io/badges/creator_b/vip.png",
    earned_at: "2026-02-10T00:00:00.000Z",
  },
  {
    badge_id: "badge_mod",
    viewer_id: "viewer_2",
    creator_id: "creator_a",
    creator_name: "AlphaStreams",
    name: "Moderator",
    image_url: "https://cdn.streamfi.io/badges/creator_a/mod.png",
    earned_at: "2026-01-20T00:00:00.000Z",
  },
];

export function getEarnedBadgesForViewer(
  viewerId: string
): EarnedBadgeRecord[] {
  return earnedBadgeStore.filter((b) => b.viewer_id === viewerId);
}
