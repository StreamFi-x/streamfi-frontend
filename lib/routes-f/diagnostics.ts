const MAX_ENTRIES_PER_ROUTE = 200;

type TimingStore = Map<string, number[]>;

const store: TimingStore = new Map();

export function recordTiming(routeKey: string, durationMs: number) {
  const arr = store.get(routeKey) ?? [];
  arr.push(durationMs);
  if (arr.length > MAX_ENTRIES_PER_ROUTE) arr.splice(0, arr.length - MAX_ENTRIES_PER_ROUTE);
  store.set(routeKey, arr);
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export function getTimingStats() {
  const out: Record<string, { min: number; max: number; avg: number; p95: number; count: number }> = {};

  for (const [key, arr] of store.entries()) {
    if (!arr.length) continue;
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
    const p95 = percentile(arr, 95);
    out[key] = { min, max, avg, p95, count: arr.length };
  }

  return out;
}

// Test helper
export function __test__resetDiagnostics() {
  store.clear();
}

export const __test__store = store;
