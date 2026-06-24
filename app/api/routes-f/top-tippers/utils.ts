import type { TipRecord, LeaderboardEntry, Timeframe } from "./types";

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 7 * ONE_DAY;
const ONE_MONTH = 30 * ONE_DAY;

export function getTimeframeMs(timeframe: Timeframe): number | null {
  switch (timeframe) {
    case "daily":
      return ONE_DAY;
    case "weekly":
      return ONE_WEEK;
    case "monthly":
      return ONE_MONTH;
    case "all-time":
      return null; // No cutoff
    default:
      return null;
  }
}

export function isValidTimeframe(timeframe: unknown): timeframe is Timeframe {
  return (
    typeof timeframe === "string" &&
    ["daily", "weekly", "monthly", "all-time"].includes(timeframe)
  );
}

export function filterTipsByTimeframe(
  tips: TipRecord[],
  timeframe: Timeframe
): TipRecord[] {
  const timeframeMs = getTimeframeMs(timeframe);
  if (timeframeMs === null) {
    return tips; // all-time
  }

  const now = Date.now();
  const cutoff = now - timeframeMs;

  return tips.filter(tip => tip.timestamp >= cutoff);
}

export function buildLeaderboard(tips: TipRecord[]): LeaderboardEntry[] {
  // Aggregate tips by tipper
  const aggregated = new Map<
    string,
    { total_usdc: number; tip_count: number }
  >();

  for (const tip of tips) {
    const existing = aggregated.get(tip.tipper) || {
      total_usdc: 0,
      tip_count: 0,
    };
    aggregated.set(tip.tipper, {
      total_usdc: existing.total_usdc + tip.amount_usdc,
      tip_count: existing.tip_count + 1,
    });
  }

  // Convert to entries
  const entries: LeaderboardEntry[] = Array.from(aggregated.entries()).map(
    ([tipper, data]) => ({
      rank: 0, // Will be set after sorting
      tipper,
      total_usdc: data.total_usdc,
      tip_count: data.tip_count,
    })
  );

  // Sort by total_usdc desc, then by tip_count desc
  entries.sort((a, b) => {
    if (a.total_usdc !== b.total_usdc) {
      return b.total_usdc - a.total_usdc;
    }
    return b.tip_count - a.tip_count;
  });

  // Assign ranks
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
}

export function validateLimit(limit: unknown): {
  valid: boolean;
  value?: number;
  error?: string;
} {
  if (limit === undefined) {
    return { valid: true, value: 10 }; // Default
  }

  const parsed = typeof limit === "string" ? parseInt(limit, 10) : limit;

  if (typeof parsed !== "number" || isNaN(parsed)) {
    return { valid: false, error: "limit must be a number" };
  }

  if (!Number.isInteger(parsed)) {
    return { valid: false, error: "limit must be an integer" };
  }

  if (parsed < 1) {
    return { valid: false, error: "limit must be at least 1" };
  }

  if (parsed > 1000) {
    return { valid: false, error: "limit must be at most 1000" };
  }

  return { valid: true, value: parsed };
}
