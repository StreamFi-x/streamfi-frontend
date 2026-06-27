export interface ViewerSample {
  minute: number;
  viewer_count: number;
}

export interface RetentionPoint {
  minute: number;
  percent_of_peak: number;
  viewer_count: number;
}

export interface RetentionCurveResponse {
  points: RetentionPoint[];
}
