import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

const STATS_CACHE_TTL_MS = 5 * 60 * 1000;
const LIVE_COUNT_TTL_MS = 30 * 1000;

interface StatsCache {
  data: PlatformStats;
  fetchedAt: number;
}

interface PlatformStats {
  total_creators: number;
  total_streams_all_time: number;
  streams_live_now: number;
  total_tips_xlm: string;
  total_gifts_usdc: string;
}

let statsCache: StatsCache | null = null;
let liveCountCache: { count: number; fetchedAt: number } | null = null;

async function fetchStats(): Promise<PlatformStats> {
  const now = Date.now();

  if (statsCache && now - statsCache.fetchedAt < STATS_CACHE_TTL_MS) {
    const liveCount = await fetchLiveCount();
    return { ...statsCache.data, streams_live_now: liveCount };
  }

  try {
    const { rows } = await sql`
      SELECT
        COUNT(DISTINCT id) AS total_creators,
        COUNT(DISTINCT id) FILTER (WHERE is_live = true) AS streams_live_now
      FROM users
    `;

    const creatorRow = rows[0] ?? {
      total_creators: 0,
      streams_live_now: 0,
    };

    const { rows: tipRows } = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN currency = 'XLM' THEN amount ELSE 0 END), 0) AS total_tips_xlm,
        COALESCE(SUM(CASE WHEN currency = 'USDC' THEN amount ELSE 0 END), 0) AS total_gifts_usdc,
        COUNT(*) AS total_streams_all_time
      FROM tip_transactions
    `;

    const tipRow = tipRows[0] ?? {
      total_tips_xlm: "0",
      total_gifts_usdc: "0",
      total_streams_all_time: 0,
    };

    const stats: PlatformStats = {
      total_creators: Number(creatorRow.total_creators),
      total_streams_all_time: Number(tipRow.total_streams_all_time),
      streams_live_now: Number(creatorRow.streams_live_now),
      total_tips_xlm: Number(tipRow.total_tips_xlm).toFixed(2),
      total_gifts_usdc: Number(tipRow.total_gifts_usdc).toFixed(2),
    };

    statsCache = { data: stats, fetchedAt: now };
    liveCountCache = {
      count: stats.streams_live_now,
      fetchedAt: now,
    };

    return stats;
  } catch {
    if (statsCache) {
      return { ...statsCache.data, streams_live_now: 0 };
    }
    return {
      total_creators: 0,
      total_streams_all_time: 0,
      streams_live_now: 0,
      total_tips_xlm: "0.00",
      total_gifts_usdc: "0.00",
    };
  }
}

async function fetchLiveCount(): Promise<number> {
  const now = Date.now();
  if (liveCountCache && now - liveCountCache.fetchedAt < LIVE_COUNT_TTL_MS) {
    return liveCountCache.count;
  }

  try {
    const { rows } = await sql`
      SELECT COUNT(*) AS live_count FROM users WHERE is_live = true
    `;
    const count = Number(rows[0]?.live_count ?? 0);
    liveCountCache = { count, fetchedAt: now };
    return count;
  } catch {
    return liveCountCache?.count ?? 0;
  }
}

const APP_VERSION = process.env.npm_package_version ?? "0.1.0";
const ENVIRONMENT =
  process.env.NODE_ENV === "production" ? "production" : "staging";
const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet";

/**
 * GET /api/routes-f/meta
 * Public endpoint returning platform metadata, stats, features, and network info.
 */
export async function GET(): Promise<NextResponse> {
  const stats = await fetchStats();

  const body = {
    platform: {
      name: "StreamFi",
      version: APP_VERSION,
      environment: ENVIRONMENT,
    },
    stats,
    features: {
      live_streaming: true,
      gifts: true,
      subscriptions: false,
      token_gating: false,
    },
    network: {
      stellar: STELLAR_NETWORK,
      mux: ENVIRONMENT === "production" ? "production" : "development",
    },
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=30",
    },
  });
}
