export interface ChatEvent {
  offset_seconds: number;
}

export interface TipEvent {
  offset_seconds: number;
  amount_usdc: number;
}

export interface StreamSample {
  stream_id: string;
  duration_seconds: number;
  chat_events: ChatEvent[];
  tip_events: TipEvent[];
}

export interface Highlight {
  start_seconds: number;
  end_seconds: number;
  score: number;
  reason: string;
}

export interface HighlightReelResponse {
  stream_id: string;
  highlights: Highlight[];
}
