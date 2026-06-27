import type { ViewerSample } from "./types";

/** stream_drop: strong audience drop-off after the first 10 minutes */
const STREAM_DROP: ViewerSample[] = [
  { minute: 0, viewer_count: 1200 },
  { minute: 5, viewer_count: 980 },
  { minute: 10, viewer_count: 850 },
  { minute: 15, viewer_count: 600 },
  { minute: 20, viewer_count: 410 },
  { minute: 25, viewer_count: 280 },
  { minute: 30, viewer_count: 190 },
  { minute: 45, viewer_count: 95 },
  { minute: 60, viewer_count: 40 },
];

/** stream_steady: audience remains roughly flat throughout */
const STREAM_STEADY: ViewerSample[] = [
  { minute: 0, viewer_count: 750 },
  { minute: 10, viewer_count: 740 },
  { minute: 20, viewer_count: 730 },
  { minute: 30, viewer_count: 725 },
  { minute: 40, viewer_count: 718 },
  { minute: 50, viewer_count: 710 },
  { minute: 60, viewer_count: 700 },
];

/** stream_single: only one data point (edge case) */
const STREAM_SINGLE: ViewerSample[] = [{ minute: 0, viewer_count: 500 }];

export const SEED_SAMPLES: Record<string, ViewerSample[]> = {
  stream_drop: STREAM_DROP,
  stream_steady: STREAM_STEADY,
  stream_single: STREAM_SINGLE,
};
