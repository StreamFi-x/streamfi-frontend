export interface SubscribersOnlyRequestBody {
  stream_id: string;
  tier_id?: string;
}

export interface SubscribersOnlyResponse {
  enabled: true;
  tier_id?: string;
}

export interface SubscribersOnlyState {
  enabled: boolean;
  tier_id?: string;
}

export interface SubscribersOnlyData {
  enabled: boolean;
  tier_id?: string;
}
