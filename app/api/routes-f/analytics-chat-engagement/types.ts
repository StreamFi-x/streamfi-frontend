export interface ChatMessageEvent {
  chatter_id: string;
  /** ISO-8601 timestamp the message was sent. */
  sent_at: string;
}

export interface StreamChatLog {
  stream_id: string;
  creator_id: string;
  messages: ChatMessageEvent[];
}

export interface ChatterEngagement {
  chatter_id: string;
  message_count: number;
}

export interface ChatEngagementResponse {
  stream_id: string;
  unique_chatters: number;
  total_messages: number;
  /** Per-chatter message counts, sorted by message_count descending. */
  chatters: ChatterEngagement[];
}
