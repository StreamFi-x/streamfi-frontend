export interface DailyActivityBucket {
  date: string;
  count: number;
}

export interface DailyActivitySummary {
  days: number;
  totalCount: number;
  buckets: DailyActivityBucket[];
}

const DEFAULT_DAYS = 7;
const MAX_DAYS = 31;

const MOCK_EVENTS: string[] = [
  "2026-02-24T20:05:00.000Z",
  "2026-02-24T10:44:00.000Z",
  "2026-02-23T15:10:00.000Z",
  "2026-02-23T03:42:00.000Z",
  "2026-02-22T06:30:00.000Z",
  "2026-02-21T08:20:00.000Z",
  "2026-02-21T22:45:00.000Z",
  "2026-02-20T09:10:00.000Z",
  "2026-02-19T19:55:00.000Z",
  "2026-02-18T12:05:00.000Z",
  "2026-02-18T23:01:00.000Z",
  "2026-02-17T02:37:00.000Z",
  "2026-02-16T16:20:00.000Z",
  "2026-02-14T11:00:00.000Z",
  "2026-02-12T21:30:00.000Z",
];

function parseDayCount(input: string | null): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DAYS;
  }

  return Math.min(Math.floor(parsed), MAX_DAYS);
}

function toDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getDailyActivitySummary(params: {
  days?: string | null;
  now?: Date;
}): DailyActivitySummary {
  const now = params.now ?? new Date();
  const days = parseDayCount(params.days ?? null);

  const bucketOrder: string[] = [];
  const bucketMap = new Map<string, number>();

  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    day.setUTCDate(day.getUTCDate() - i);
    const key = toDayKey(day);
    bucketOrder.push(key);
    bucketMap.set(key, 0);
  }

  for (const eventIso of MOCK_EVENTS) {
    const key = eventIso.slice(0, 10);
    if (bucketMap.has(key)) {
      bucketMap.set(key, (bucketMap.get(key) ?? 0) + 1);
    }
  }

  const buckets = bucketOrder.map(date => ({
    date,
    count: bucketMap.get(date) ?? 0,
  }));

  const totalCount = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return {
    days,
    totalCount,
    buckets,
  };
}

export function getActivityLimitConfig() {
  return {
    defaultDays: DEFAULT_DAYS,
    maxDays: MAX_DAYS,
  };
}
