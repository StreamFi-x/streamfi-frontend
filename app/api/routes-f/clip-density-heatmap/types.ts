export interface Clip {
  clip_id: string;
  stream_id: string;
  // Seconds from the start of the stream when the clip was created.
  offset_seconds: number;
}

export interface HeatmapBucket {
  minute_offset: number;
  clip_count: number;
}

export interface ClipDensityHeatmapResponse {
  stream_id: string;
  buckets: HeatmapBucket[];
  peak_minute: number | null;
}
