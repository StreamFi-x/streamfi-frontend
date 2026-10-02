export interface IntermissionRequestBody {
  stream_id: string;
  message: string;
  ends_at?: string;
}

export interface IntermissionResponse {
  active: true;
}

export interface IntermissionState {
  active: boolean;
  message?: string;
  ends_at?: string;
  seconds_remaining?: number;
}
