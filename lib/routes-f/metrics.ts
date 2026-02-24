import { MetricsKey, MetricsSnapshot } from "./types";

const METRIC_KEYS: MetricsKey[] = [
  "flags",
  "search",
  "export",
  "maintenance",
  "metrics",
];

const totals: Record<MetricsKey, number> = {
  flags: 0,
  search: 0,
  export: 0,
  maintenance: 0,
  metrics: 0,
};

const eventTimestamps: Record<MetricsKey, number[]> = {
  flags: [],
  search: [],
  export: [],
  maintenance: [],
  metrics: [],
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

export function recordMetric(key: MetricsKey, at = Date.now()) {
  totals[key] += 1;
  eventTimestamps[key].push(at);
}

function pruneOldEvents(now: number) {
  METRIC_KEYS.forEach(key => {
    eventTimestamps[key] = eventTimestamps[key].filter(
      timestamp => now - timestamp <= WINDOW_MS
    );
  });
}

function buildHourlySeries(now: number) {
  const series: Array<{ hourStart: string; counts: Record<MetricsKey, number> }> = [];
  const start = now - WINDOW_MS;

  for (let i = 0; i < 24; i += 1) {
    const bucketStart = start + i * 60 * 60 * 1000;
    const bucketEnd = bucketStart + 60 * 60 * 1000;

    const counts = METRIC_KEYS.reduce((acc, key) => {
      acc[key] = eventTimestamps[key].filter(
        timestamp => timestamp >= bucketStart && timestamp < bucketEnd
      ).length;
      return acc;
    }, {} as Record<MetricsKey, number>);

    series.push({
      hourStart: new Date(bucketStart).toISOString(),
      counts,
    });
  }

  return series;
}

export function getMetricsSnapshot(now = Date.now()): MetricsSnapshot {
  pruneOldEvents(now);

  const last24h = METRIC_KEYS.reduce((acc, key) => {
    acc[key] = eventTimestamps[key].length;
    return acc;
  }, {} as Record<MetricsKey, number>);

  return {
    generatedAt: new Date(now).toISOString(),
    resetOnRestart: true,
    totals: { ...totals },
    last24h,
    series: buildHourlySeries(now),
  };
}

export function __test__resetMetrics() {
  METRIC_KEYS.forEach(key => {
    totals[key] = 0;
    eventTimestamps[key] = [];
  });
}
