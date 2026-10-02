import type { DailyMetricPoint, ExportMetric, MetricSeries } from "./types";

/**
 * Seed daily metric series for the StreamFi platform, keyed by
 * `${metric}:${channel_id}`. Mirrors the day-bucketed shape used by
 * analytics-daily-revenue / analytics-daily-viewers so this route can be
 * swapped to read from the same source once those are wired to a shared
 * store; for now it's self-contained, seeded data so the CSV export can be
 * tested without a live database.
 */
const SEED_SERIES: Record<string, DailyMetricPoint[]> = {
  "revenue:channel_a": [
    { date: "2026-06-18", value: 42.5 },
    { date: "2026-06-19", value: 18 },
    { date: "2026-06-20", value: 93.25 },
  ],
  "viewers:channel_a": [
    { date: "2026-06-18", value: 120 },
    { date: "2026-06-19", value: 95 },
    { date: "2026-06-20", value: 210 },
  ],
  "revenue:channel_b": [{ date: "2026-06-20", value: 0 }],
};

export function getMetricSeries(
  metric: ExportMetric,
  channelId: string
): MetricSeries | undefined {
  const points = SEED_SERIES[`${metric}:${channelId}`];
  if (!points) {
    return undefined;
  }
  return { metric, channel_id: channelId, points };
}
