export const ACTIVITY_EVENT_TYPES = [
  "tip_received",
  "tip_sent",
  "new_follower",
  "stream_started",
  "stream_ended",
  "gift_received",
  "gift_sent",
  "recording_ready",
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export type ActivityFeedFilter = "all" | "tips" | "follows" | "streams" | "gifts";

export interface ActivityEventRow {
  id: string;
  user_id: string;
  type: ActivityEventType;
  actor_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityEventResponse {
  id: string;
  type: ActivityEventType;
  actor: { username: string; avatar: string | null } | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ActivityFeedResponse {
  events: ActivityEventResponse[];
  next_cursor: string | null;
}

export interface DailySummaryResponse {
  date: string;
  tips_received: number;
  followers_gained: number;
  stream_duration_seconds: number;
  peak_viewers: number;
}

export interface InsertActivityEventInput {
  userId: string;
  type: ActivityEventType;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}
