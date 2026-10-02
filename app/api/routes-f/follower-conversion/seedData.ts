import type { ViewerEvent, FollowEvent } from "./types";

const ONE_DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): number {
  return Date.now() - days * ONE_DAY;
}

// Deterministic seed events, offset in whole days from "now" so window_days
// filtering produces exactly reproducible math without relying on wall-clock
// boundaries falling mid-test-run.
export const viewerEventStore: ViewerEvent[] = [
  { creator_id: "creator_alpha", viewer: "viewer_1", timestamp: daysAgo(5) },
  { creator_id: "creator_alpha", viewer: "viewer_2", timestamp: daysAgo(10) },
  { creator_id: "creator_alpha", viewer: "viewer_3", timestamp: daysAgo(15) },
  { creator_id: "creator_alpha", viewer: "viewer_4", timestamp: daysAgo(25) },
  { creator_id: "creator_alpha", viewer: "viewer_5", timestamp: daysAgo(40) },
  { creator_id: "creator_alpha", viewer: "viewer_6", timestamp: daysAgo(50) },
  { creator_id: "creator_alpha", viewer: "viewer_7", timestamp: daysAgo(2) },
  { creator_id: "creator_alpha", viewer: "viewer_8", timestamp: daysAgo(29) },
  { creator_id: "creator_alpha", viewer: "viewer_9", timestamp: daysAgo(31) },
  { creator_id: "creator_alpha", viewer: "viewer_10", timestamp: daysAgo(1) },

  // creator_beta — nobody converts within any reasonable window.
  { creator_id: "creator_beta", viewer: "viewer_20", timestamp: daysAgo(3) },
  { creator_id: "creator_beta", viewer: "viewer_21", timestamp: daysAgo(6) },
];

export const followEventStore: FollowEvent[] = [
  { creator_id: "creator_alpha", viewer: "viewer_1", timestamp: daysAgo(4) },
  { creator_id: "creator_alpha", viewer: "viewer_3", timestamp: daysAgo(14) },
  { creator_id: "creator_alpha", viewer: "viewer_7", timestamp: daysAgo(1) },
  { creator_id: "creator_alpha", viewer: "viewer_5", timestamp: daysAgo(38) },
  // viewer_11 follows creator_alpha but never appears in viewerEventStore —
  // shouldn't count as a conversion since they were never counted as a viewer.
  { creator_id: "creator_alpha", viewer: "viewer_11", timestamp: daysAgo(3) },
];

export function getViewerEvents(creatorId: string): ViewerEvent[] {
  return viewerEventStore.filter(e => e.creator_id === creatorId);
}

export function getFollowEvents(creatorId: string): FollowEvent[] {
  return followEventStore.filter(e => e.creator_id === creatorId);
}
