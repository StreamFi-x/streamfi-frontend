export interface ChatEvent {
  message_id: string;
  /** Seconds after the stream started. */
  offset_seconds: number;
}

export interface ChatStream {
  stream_id: string;
  title: string;
  events: ChatEvent[];
}

export interface MinuteSeriesPoint {
  minute_offset: number;
  messages: number;
}

export interface ChatVelocityResponse {
  series: MinuteSeriesPoint[];
  peak_minute: number;
  total_messages: number;
}
