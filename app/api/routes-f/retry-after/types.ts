export interface RetryAfterRequest {
  header: string;
  now?: string;
}

export interface RetryAfterResponse {
  delay_seconds: number;
  retry_at: string;
}
