export type SessionStatus = "live" | "completed";

export interface StreamSession {
  stream_id: string;
  creator_id: string;
  status: SessionStatus;
  /** ISO-8601 start time. */
  started_at: string;
  /** ISO-8601 end time, or null while the stream is still live. */
  ended_at: string | null;
  /** Concurrent viewer counts sampled at regular intervals during the stream. */
  viewer_samples: number[];
  /** Distinct viewer ids seen across the session. */
  unique_viewer_ids: string[];
  /** Total chat messages sent during the session. */
  messages: number;
  /** Individual tip amounts in USDC. */
  tips_usdc: number[];
}

export interface StreamAnalyticsSummary {
  duration_minutes: number;
  peak_viewers: number;
  average_viewers: number;
  unique_viewers: number;
  total_messages: number;
  total_tips_usdc: number;
}
