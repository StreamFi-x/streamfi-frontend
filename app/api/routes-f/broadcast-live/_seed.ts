/**
 * FOLLOWERS: creator_id → list of follower_ids that follow that creator.
 */
export const FOLLOWERS: Map<string, string[]> = new Map([
  [
    "creator-alpha",
    [
      "viewer-001",
      "viewer-002",
      "viewer-003",
      "viewer-004",
      "viewer-005",
    ],
  ],
  [
    "creator-beta",
    ["viewer-006", "viewer-007", "viewer-008"],
  ],
  [
    "creator-delta",
    ["viewer-001", "viewer-009", "viewer-010"],
  ],
]);

/**
 * MUTED_PAIRS: Set of "follower_id:creator_id" combos where the follower
 * has muted notifications for that creator.
 */
export const MUTED_PAIRS: Set<string> = new Set([
  "viewer-002:creator-alpha",
  "viewer-007:creator-beta",
]);
