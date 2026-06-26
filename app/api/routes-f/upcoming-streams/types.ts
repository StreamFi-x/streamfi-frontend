export type StreamPrivacy = "public" | "unlisted" | "subscribers-only";

export interface ScheduledStream {
  stream_id: string;
  creator_id: string;
  creator_name: string;
  title: string;
  category: string;
  privacy: StreamPrivacy;
  /** ISO-8601 timestamp for when the stream is scheduled to begin. */
  starts_at: string;
  thumbnail_url: string;
}

export interface UpcomingStreamsResponse {
  scheduled: ScheduledStream[];
}
