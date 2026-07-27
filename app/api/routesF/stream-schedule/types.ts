export type StreamPrivacy = "public" | "unlisted" | "subscribers-only";

export interface ScheduledStream {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  category: string;
  /** ISO 8601 UTC start time. */
  starts_at: string;
  duration_minutes: number;
  privacy: StreamPrivacy;
}

export interface ScheduleJsonResponse {
  creator_id: string;
  streams: ScheduledStream[];
}
