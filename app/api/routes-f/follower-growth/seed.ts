import type { FollowEvent } from "./types";

/**
 * Seed follow events for the growth chart.
 *
 * Timestamps are intentionally spread across several days, weeks and months so
 * that bucketing at every granularity has meaningful structure. creator_a has
 * the bulk of the activity; creator_b is a quieter creator.
 */
export const followEvents: FollowEvent[] = [
  { creator_id: "creator_a", follower_id: "v1", followed_at: "2026-01-03T10:00:00Z" },
  { creator_id: "creator_a", follower_id: "v2", followed_at: "2026-01-03T18:30:00Z" },
  { creator_id: "creator_a", follower_id: "v3", followed_at: "2026-01-05T09:15:00Z" },
  { creator_id: "creator_a", follower_id: "v4", followed_at: "2026-01-12T22:00:00Z" },
  { creator_id: "creator_a", follower_id: "v5", followed_at: "2026-01-19T08:45:00Z" },
  { creator_id: "creator_a", follower_id: "v6", followed_at: "2026-02-02T14:00:00Z" },
  { creator_id: "creator_a", follower_id: "v7", followed_at: "2026-02-02T15:30:00Z" },
  { creator_id: "creator_a", follower_id: "v8", followed_at: "2026-02-21T11:00:00Z" },
  { creator_id: "creator_a", follower_id: "v9", followed_at: "2026-03-04T19:00:00Z" },

  { creator_id: "creator_b", follower_id: "v10", followed_at: "2026-01-08T12:00:00Z" },
  { creator_id: "creator_b", follower_id: "v11", followed_at: "2026-01-29T17:20:00Z" },
  { creator_id: "creator_b", follower_id: "v12", followed_at: "2026-03-15T06:00:00Z" },
];

export function eventsForCreator(creatorId: string): FollowEvent[] {
  return followEvents.filter(e => e.creator_id === creatorId);
}
