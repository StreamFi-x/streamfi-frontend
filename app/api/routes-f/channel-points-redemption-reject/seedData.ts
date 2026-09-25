import type { Redemption } from "./types";

// Points were already deducted from the viewer's balance when the redemption
// was requested, so a reject must credit `cost` back to this balance.
export const balances = new Map<string, number>([
  ["viewer_1:creator_a", 300],
  ["viewer_2:creator_a", 0],
  ["viewer_3:creator_b", 900],
]);

export function balanceKey(viewerId: string, creatorId: string): string {
  return `${viewerId}:${creatorId}`;
}

export const redemptionStore = new Map<string, Redemption>([
  [
    "redemption_pending_1",
    {
      redemption_id: "redemption_pending_1",
      viewer_id: "viewer_1",
      creator_id: "creator_a",
      item_name: "Custom Emote",
      cost: 500,
      status: "pending",
      created_at: "2026-01-01T00:00:00.000Z",
      resolved_at: null,
      resolved_by: null,
    },
  ],
  [
    "redemption_pending_2",
    {
      redemption_id: "redemption_pending_2",
      viewer_id: "viewer_3",
      creator_id: "creator_b",
      item_name: "Shoutout",
      cost: 1000,
      status: "pending",
      created_at: "2026-01-02T00:00:00.000Z",
      resolved_at: null,
      resolved_by: null,
    },
  ],
  [
    "redemption_already_rejected",
    {
      redemption_id: "redemption_already_rejected",
      viewer_id: "viewer_2",
      creator_id: "creator_a",
      item_name: "Play a Song",
      cost: 2000,
      status: "rejected",
      created_at: "2025-12-01T00:00:00.000Z",
      resolved_at: "2025-12-01T01:00:00.000Z",
      resolved_by: "mod_previous",
    },
  ],
  [
    "redemption_already_approved",
    {
      redemption_id: "redemption_already_approved",
      viewer_id: "viewer_2",
      creator_id: "creator_a",
      item_name: "Custom Emote",
      cost: 500,
      status: "approved",
      created_at: "2025-12-02T00:00:00.000Z",
      resolved_at: "2025-12-02T01:00:00.000Z",
      resolved_by: "mod_previous",
    },
  ],
]);
