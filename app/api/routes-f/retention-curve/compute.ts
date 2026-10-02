import type { ViewerSample, RetentionPoint } from "./types";

export function normalizeRetention(samples: ViewerSample[]): RetentionPoint[] {
  if (samples.length === 0) {return [];}

  const peak = Math.max(...samples.map((s) => s.viewer_count));

  return samples.map((s) => ({
    minute: s.minute,
    viewer_count: s.viewer_count,
    percent_of_peak:
      peak === 0 ? 0 : Math.round((s.viewer_count / peak) * 10000) / 100,
  }));
}
