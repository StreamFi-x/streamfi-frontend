export interface CategorySwitchRequest {
  stream_id: string;
  category: string;
}

export interface CategorySwitchResponse {
  previous_category: string;
  new_category: string;
  switched_at: string;
}

export interface CategoryTimelineEntry {
  category: string;
  switched_at: string;
}
