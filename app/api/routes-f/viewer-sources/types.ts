export type ReferrerSource = "direct" | "explore" | "social" | "embed";

export interface ViewerSession {
  stream_id: string;
  viewer_id: string;
  /** Where the viewer arrived from. */
  source: ReferrerSource;
}

export interface SourceBreakdown {
  source: ReferrerSource;
  viewers: number;
  /** Share of total viewers, 0..100, rounded to 2 decimals. */
  percent: number;
}

export interface ViewerSourcesResponse {
  sources: SourceBreakdown[];
  total: number;
}
