import leaderboardSeed from "../leaderboard.seed.json";
import type {
  LeaderboardEntry,
  LeaderboardSeedEntry,
  Timeframe,
} from "./types";

const seedEntries = leaderboardSeed as LeaderboardSeedEntry[];
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const DEFAULT_TIMEFRAME: Timeframe = "weekly";

function isTimeframe(value: string): value is Timeframe {
  return ["daily", "weekly", "monthly", "all-time"].includes(value);
}

export function parseTimeframe(value: string | null): Timeframe {
  if (!value) {
    return DEFAULT_TIMEFRAME;
  }

  if (!isTimeframe(value)) {
    throw new Error("Invalid timeframe. Use daily, weekly, monthly, or all-time.");
  }

  return value;
}

export function parsePositiveInteger(
  value: string | null,
  fallback: number,
  label: string
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}

function getTimeframeScore(seed: number, timeframe: Timeframe): number {
  switch (timeframe) {
    case "daily":
      return 1000 - Math.abs(seed - 7) * 19 + (seed % 3);
    case "weekly":
      return 1100 - Math.abs(seed - 23) * 17 + (seed % 5);
    case "monthly":
      return 1200 - Math.abs(seed - 41) * 13 + (seed % 7);
    case "all-time":
      return seed * 31 + (seed % 11);
  }
}

function buildRankedEntries(timeframe: Timeframe): LeaderboardEntry[] {
  return seedEntries
    .map(entry => ({
      username: entry.username,
      avatar_url: entry.avatar_url,
      score: getTimeframeScore(entry.seed, timeframe),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.username.localeCompare(right.username);
    })
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));
}

export function buildLeaderboardResponse(options: {
  timeframe: Timeframe;
  limit?: number;
  page?: number;
  now?: () => Date;
}) {
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const page = options.page ?? 1;
  const now = options.now ?? (() => new Date());

  const rankedEntries = buildRankedEntries(options.timeframe);
  const offset = (page - 1) * limit;
  const entries = rankedEntries.slice(offset, offset + limit);

  return {
    entries,
    updated_at: now().toISOString(),
    page,
    limit,
    total: rankedEntries.length,
    has_more: offset + limit < rankedEntries.length,
    timeframe: options.timeframe,
  };
}
