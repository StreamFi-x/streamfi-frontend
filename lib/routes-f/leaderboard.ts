import { getRoutesFRecords } from "./store";

export const ALLOWED_METRICS = ["views", "score"] as const;
export type Metric = (typeof ALLOWED_METRICS)[number];

// Helper used by tests: compute leaderboard from an explicit metric map.
export function computeLeaderboardFromMap(
  metrics: Record<string, number>,
  limit: number
) {
  const rows = Object.keys(metrics).map((id) => ({ id, value: metrics[id] }));

  rows.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return a.id.localeCompare(b.id);
  });

  return rows.slice(0, limit).map((r, idx) => ({ rank: idx + 1, id: r.id, value: r.value }));
}

// Deterministic synthetic metric generation for the real endpoint.
function syntheticMetricFor(metric: Metric, id: string): number {
  // Simple deterministic hash-ish mapping: sum of char codes + metric-specific offset
  const sum = [...id].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  if (metric === "views") return (sum % 1000) + 100; // keep >0
  return (sum % 500) + 10; // score
}

export function computeLeaderboard(metric: Metric, limit = 10) {
  const records = getRoutesFRecords();
  const metrics: Record<string, number> = {};
  for (const r of records) metrics[r.id] = syntheticMetricFor(metric, r.id);

  return computeLeaderboardFromMap(metrics, limit);
}
