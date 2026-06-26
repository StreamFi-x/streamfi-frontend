import type { CategoryPerformance, StreamRecord } from "./types";

/** Round to 2 decimal places, avoiding negative-zero. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100 || 0;
}

interface Accumulator {
  stream_count: number;
  total_viewers: number;
  total_tips: number;
}

/**
 * Aggregate a creator's streams into per-category performance.
 *
 * For each category, computes stream_count and the mean viewers and tips per
 * stream. Results are sorted by stream_count descending (ties broken by
 * category name for stable ordering).
 */
export function aggregateByCategory(
  streams: StreamRecord[]
): CategoryPerformance[] {
  const byCategory = new Map<string, Accumulator>();

  for (const stream of streams) {
    const acc = byCategory.get(stream.category) ?? {
      stream_count: 0,
      total_viewers: 0,
      total_tips: 0,
    };
    acc.stream_count += 1;
    acc.total_viewers += stream.viewers;
    acc.total_tips += stream.tips_usdc;
    byCategory.set(stream.category, acc);
  }

  return [...byCategory.entries()]
    .map(([category, acc]) => ({
      category,
      stream_count: acc.stream_count,
      avg_viewers: round2(acc.total_viewers / acc.stream_count),
      avg_tips_usdc: round2(acc.total_tips / acc.stream_count),
    }))
    .sort((a, b) => {
      if (b.stream_count !== a.stream_count) {
        return b.stream_count - a.stream_count;
      }
      return a.category.localeCompare(b.category);
    });
}
