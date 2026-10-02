export interface ViewerVisitRecord {
  stream_id: string;
  viewer: string;
  prior_visits: number;
}

export interface ReturningViewerEntry {
  viewer: string;
  prior_visits: number;
}

export interface ReturningViewersResponse {
  returning_count: number;
  avg_prior_visits: number;
  top_returning: ReturningViewerEntry[];
}
