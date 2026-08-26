export interface ChatEvent {
  offset_seconds: number;
}

export interface TipEvent {
  offset_seconds: number;
  amount_usdc: number;
}

export interface LastSession {
  creator_id: string;
  stream_id: string;
  ended_at: string;
  duration_seconds: number;
  chat_events: ChatEvent[];
  tip_events: TipEvent[];
}

export interface HighlightTimestamp {
  start_seconds: number;
  end_seconds: number;
  score: number;
  reason: string;
}

export interface StreamHighlightReelResponse {
  creator_id: string;
  stream_id: string;
  ended_at: string;
  highlights: HighlightTimestamp[];
}
