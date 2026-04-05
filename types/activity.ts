export type ActivityEventType =
  | "tip_received"
  | "tip_sent"
  | "new_follower"
  | "stream_started"
  | "stream_ended"
  | "gift_received"
  | "gift_sent"
  | "recording_ready";

export type ActivityTypeFilter =
  | "all"
  | "tips"
  | "follows"
  | "streams"
  | "gifts";

/** Maps a query-param filter value to the DB event types it includes. `null` = no filter. */
export const FILTER_TO_TYPES: Record<
  ActivityTypeFilter,
  ActivityEventType[] | null
> = {
  all: null,
  tips: ["tip_received", "tip_sent"],
  follows: ["new_follower"],
  streams: ["stream_started", "stream_ended", "recording_ready"],
  gifts: ["gift_received", "gift_sent"],
};

export interface ActivityActor {
  username: string;
  avatar: string | null;
}

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  actor: ActivityActor | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityFeedResponse {
  events: ActivityEvent[];
  next_cursor: string | null;
}

export interface DailySummaryResponse {
  date: string;
  tips_received: number;
  tips_received_xlm: string;
  followers_gained: number;
  stream_duration_s: number;
  peak_viewers: number;
}
