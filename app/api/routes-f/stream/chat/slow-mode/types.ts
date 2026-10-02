export interface SlowModeRequestBody {
  stream_id: string;
  interval_seconds: number;
}

export interface SlowModeResponse {
  enabled: true;
  interval_seconds: number;
}

export interface SlowModeState {
  enabled: boolean;
  interval_seconds?: number;
}

export interface SlowModeData {
  enabled: boolean;
  interval_seconds: number;
}
