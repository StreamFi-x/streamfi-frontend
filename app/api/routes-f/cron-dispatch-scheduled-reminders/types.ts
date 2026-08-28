export interface ScheduledReminder {
  id: string;
  viewer_id: string;
  stream_id: string;
  /** ISO-8601 instant the stream is expected to start / the reminder should fire. */
  fires_at: string;
  dispatched: boolean;
  /** Set once dispatched — kept for observability, not read by dispatch logic. */
  dispatched_at: string | null;
}
