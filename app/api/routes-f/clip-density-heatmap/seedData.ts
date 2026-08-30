import type { Clip } from "./types";

// Offsets are seconds from stream start. "stream_dense" has a clear peak
// minute (minute 5) to exercise bucketing + peak detection; "stream_sparse"
// has a single clip; "stream_no_clips" has none.
export const clips: Clip[] = [
  { clip_id: "clip_1", stream_id: "stream_dense", offset_seconds: 12 },
  { clip_id: "clip_2", stream_id: "stream_dense", offset_seconds: 45 },
  { clip_id: "clip_3", stream_id: "stream_dense", offset_seconds: 300 },
  { clip_id: "clip_4", stream_id: "stream_dense", offset_seconds: 305 },
  { clip_id: "clip_5", stream_id: "stream_dense", offset_seconds: 310 },
  { clip_id: "clip_6", stream_id: "stream_dense", offset_seconds: 330 },
  { clip_id: "clip_7", stream_id: "stream_dense", offset_seconds: 600 },
  { clip_id: "clip_8", stream_id: "stream_sparse", offset_seconds: 90 },
];
