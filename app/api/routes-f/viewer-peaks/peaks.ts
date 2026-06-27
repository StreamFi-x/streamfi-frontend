import type { StreamSessionPeak, ViewerPeakEntry } from "./types";

/**
 * Derive the peak concurrent viewer count and the timestamp when it occurred
 * from a stream's sampled viewer timeline.
 */
export function computePeak(session: StreamSessionPeak): ViewerPeakEntry {
  if (session.viewer_samples.length === 0) {
    return {
      stream_id: session.stream_id,
      peak_viewers: 0,
      peaked_at: session.sample_timestamps[0] ?? new Date(0).toISOString(),
      title: session.title,
    };
  }

  let peakIndex = 0;
  for (let i = 1; i < session.viewer_samples.length; i++) {
    if (session.viewer_samples[i] > session.viewer_samples[peakIndex]) {
      peakIndex = i;
    }
  }

  return {
    stream_id: session.stream_id,
    peak_viewers: session.viewer_samples[peakIndex],
    peaked_at: session.sample_timestamps[peakIndex],
    title: session.title,
  };
}

/**
 * Return the top N peak viewer entries for a creator, sorted by peak desc.
 */
export function getTopPeaks(
  sessions: StreamSessionPeak[],
  limit: number
): ViewerPeakEntry[] {
  return sessions
    .map(computePeak)
    .sort((a, b) => b.peak_viewers - a.peak_viewers)
    .slice(0, limit);
}

export function parseLimit(raw: string | null, defaultLimit = 10): number | null {
  if (raw === null || raw === "") {
    return defaultLimit;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}
