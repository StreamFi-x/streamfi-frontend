export interface ChatRestrictionRequestBody {
  stream_id: string;
  min_follow_minutes?: number;
}

export interface ChatRestrictionResponse {
  enabled: true;
  min_follow_minutes: number;
}

export interface ChatRestrictionState {
  enabled: boolean;
  min_follow_minutes?: number;
}
