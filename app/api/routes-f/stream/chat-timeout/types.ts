export interface TimeoutEntry {
  stream_id: string;
  user_id: string;
  reason?: string;
  expires_at: string;
}

export interface TimeoutListItem {
  user_id: string;
  reason?: string;
  expires_at: string;
  seconds_remaining: number;
}
