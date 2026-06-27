export interface StreamSessionPeak {
  stream_id: string;
  creator_id: string;
  title: string;
  /** Concurrent viewer counts sampled at regular intervals during the stream. */
  viewer_samples: number[];
  /** ISO-8601 timestamps aligned with each viewer sample. */
  sample_timestamps: string[];
}

export interface ViewerPeakEntry {
  stream_id: string;
  peak_viewers: number;
  peaked_at: string;
  title: string;
}

export interface ViewerPeaksResponse {
  peaks: ViewerPeakEntry[];
}
