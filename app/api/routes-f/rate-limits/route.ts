import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";

interface RateLimitWindow {
  resource: string;
  limit: number;
  remaining: number;
  reset_at: string;
}

interface ResourceConfig {
  resource: string;
  limit: number;
  window_ms: number;
}

const RESOURCES: ResourceConfig[] = [
  { resource: "chat_messages", limit: 30, window_ms: 60 * 1000 },
  { resource: "tips", limit: 10, window_ms: 60 * 1000 },
  { resource: "reports", limit: 5, window_ms: 10 * 60 * 1000 },
  { resource: "api_calls", limit: 100, window_ms: 60 * 1000 },
];

const hasRedis =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisGet(key: string): Promise<string | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;

  try {
    const res = await fetch(`${url}/GET/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as { result: string | null };
    return data.result;
  } catch {
    return null;
  }
}

async function redisTtl(key: string): Promise<number> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;

  try {
    const res = await fetch(`${url}/TTL/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as { result: number };
    return data.result > 0 ? data.result : 0;
  } catch {
    return 0;
  }
}

async function getWindowForResource(
  userId: string,
  config: ResourceConfig
): Promise<RateLimitWindow> {
  if (!hasRedis) {
    return {
      resource: config.resource,
      limit: config.limit,
      remaining: config.limit,
      reset_at: new Date(Date.now() + config.window_ms).toISOString(),
    };
  }

  const key = `ratelimit:${config.resource}:${userId}`;
  const [countStr, ttlSeconds] = await Promise.all([
    redisGet(key),
    redisTtl(key),
  ]);

  const count = countStr ? parseInt(countStr, 10) : 0;
  const remaining = Math.max(0, config.limit - count);
  const resetAt =
    ttlSeconds > 0
      ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
      : new Date(Date.now() + config.window_ms).toISOString();

  return {
    resource: config.resource,
    limit: config.limit,
    remaining,
    reset_at: resetAt,
  };
}

/**
 * GET /api/routes-f/rate-limits
 * Returns per-resource rate limit windows for the authenticated user.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const windows = await Promise.all(
    RESOURCES.map(config => getWindowForResource(session.userId, config))
  );

  return NextResponse.json({ rate_limits: windows });
}
