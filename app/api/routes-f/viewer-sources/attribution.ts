import type { ReferrerSource, SourceBreakdown, ViewerSession } from "./types";

/** Round to 2 decimal places, avoiding negative-zero. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100 || 0;
}

/**
 * Break viewer sessions down by referrer source.
 *
 * Returns one entry per source that has at least one viewer, sorted by viewer
 * count descending (ties broken by source name for stable ordering), with each
 * source's percentage of the total. `total` is the number of sessions.
 */
export function attributeSources(sessions: ViewerSession[]): {
  sources: SourceBreakdown[];
  total: number;
} {
  const total = sessions.length;

  const counts = new Map<ReferrerSource, number>();
  for (const session of sessions) {
    counts.set(session.source, (counts.get(session.source) ?? 0) + 1);
  }

  const sources: SourceBreakdown[] = [...counts.entries()]
    .map(([source, viewers]) => ({
      source,
      viewers,
      percent: total === 0 ? 0 : round2((viewers / total) * 100),
    }))
    .sort((a, b) => {
      if (b.viewers !== a.viewers) return b.viewers - a.viewers;
      return a.source.localeCompare(b.source);
    });

  return { sources, total };
}
