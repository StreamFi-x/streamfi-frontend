export interface PinnedMessage {
  stream_id: string;
  message_id: string;
  message_text: string;
  pinned_by: string;
  pinned_at: string;
  expires_at?: string;
}

export interface PinResponse {
  pinned_at: string;
  expires_at?: string;
}
