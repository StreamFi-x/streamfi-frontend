import type { FollowEvent, Granularity, GrowthBucket } from "./types";

/** Format a Date as a UTC ISO date string (YYYY-MM-DD). */
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Return the UTC bucket-start date for a timestamp at the given granularity.
 *
 * - day:   midnight of that day.
 * - week:  the preceding Monday (ISO week start).
 * - month: the first of the month.
 */
export function bucketStart(timestamp: string, granularity: Granularity): string {
  const d = new Date(timestamp);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();

  if (granularity === "month") {
    return toIsoDate(new Date(Date.UTC(year, month, 1)));
  }
  if (granularity === "week") {
    const start = new Date(Date.UTC(year, month, day));
    // getUTCDay: 0 = Sunday .. 6 = Saturday. Shift so Monday is the start.
    const dow = start.getUTCDay();
    const diff = dow === 0 ? 6 : dow - 1;
    start.setUTCDate(start.getUTCDate() - diff);
    return toIsoDate(start);
  }
  // day
  return toIsoDate(new Date(Date.UTC(year, month, day)));
}

/**
 * Build a cumulative growth series from raw follow events.
 *
 * Events are grouped into buckets by `bucket_start`, buckets are ordered
 * chronologically, and each bucket's `count` is the running cumulative total of
 * followers up to and including that bucket. `total` is the final cumulative
 * count (equal to the number of events).
 */
export function buildGrowthSeries(
  events: FollowEvent[],
  granularity: Granularity
): { series: GrowthBucket[]; total: number } {
  const perBucket = new Map<string, number>();
  for (const event of events) {
    const key = bucketStart(event.followed_at, granularity);
    perBucket.set(key, (perBucket.get(key) ?? 0) + 1);
  }

  const orderedKeys = [...perBucket.keys()].sort();
  const series: GrowthBucket[] = [];
  let cumulative = 0;
  for (const key of orderedKeys) {
    cumulative += perBucket.get(key)!;
    series.push({ bucket_start: key, count: cumulative });
  }

  return { series, total: cumulative };
}
