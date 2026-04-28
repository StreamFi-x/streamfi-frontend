export type TimeStyle = "long" | "short" | "narrow";

export interface TimeAgoRequest {
  timestamp: number | string;
  now?: number | string;
  style?: TimeStyle;
  locale?: string;
}

export interface TimeAgoResponse {
  ago: string;
  seconds_diff: number;
  is_future: boolean;
}
