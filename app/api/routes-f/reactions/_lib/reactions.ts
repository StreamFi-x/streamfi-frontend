import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { Ratelimit } from "@upstash/ratelimit";
import { z } from "zod";
import { getUpstashRedis } from "@/lib/upstash";

export const REACTIONS = [
  "❤️",
  "🔥",
  "😂",
  "👏",
  "💜",
  "🎉",
  "😮",
  "👑",
] as const;

export const reactionEmojiSchema = z.enum(REACTIONS);

type ReactionEmoji = (typeof REACTIONS)[number];
type ReactionCounts = Record<string, number>;

const CACHE_TTL_SECONDS = 2;
const RATE_LIMIT_WINDOW_SECONDS = 10;
const RATE_LIMIT_MAX = 10;

const memoryRateLimiter = new Map<string, number[]>();
const memoryCache = new Map<
  string,
  { expiresAt: number; value: ReactionSummary }
>();

let rateLimiter: Ratelimit | null | undefined;

export type ReactionSummary = {
  reactions: ReactionCounts;
  total: number;
};

function getReactionKey(streamId: string, emoji: ReactionEmoji): string {
  return `reactions:${streamId}:${emoji}`;
}

function getReactionCacheKey(streamId: string): string {
  return `reactions-cache:${streamId}`;
}

function getRequesterId(req: NextRequest, userId?: string | null): string {
  if (userId) {
    return `user:${userId}`;
  }

  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  return `ip:${forwarded || realIp || "unknown"}`;
}

async function getRateLimiter(): Promise<Ratelimit | null> {
  if (rateLimiter !== undefined) {
    return rateLimiter;
  }

  const redis = await getUpstashRedis();
  rateLimiter = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(
          RATE_LIMIT_MAX,
          `${RATE_LIMIT_WINDOW_SECONDS} s`
        ),
        analytics: false,
      })
    : null;

  return rateLimiter;
}

function getCachedMemorySummary(streamId: string): ReactionSummary | null {
  const cached = memoryCache.get(streamId);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    memoryCache.delete(streamId);
    return null;
  }

  return cached.value;
}

function setCachedMemorySummary(
  streamId: string,
  summary: ReactionSummary
): void {
  memoryCache.set(streamId, {
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
    value: summary,
  });
}

export async function ensureStreamReactionColumns(): Promise<void> {
  await sql`
    ALTER TABLE stream_sessions
    ADD COLUMN IF NOT EXISTS reaction_counts JSONB NOT NULL DEFAULT '{}'::jsonb
  `;

  await sql`
    ALTER TABLE stream_sessions
    ADD COLUMN IF NOT EXISTS reaction_total INTEGER NOT NULL DEFAULT 0
  `;
}

export async function enforceReactionRateLimit(
  req: NextRequest,
  streamId: string,
  userId?: string | null
): Promise<boolean> {
  const requesterId = `${streamId}:${getRequesterId(req, userId)}`;
  const redisLimiter = await getRateLimiter();

  if (redisLimiter) {
    const { success } = await redisLimiter.limit(requesterId);
    return !success;
  }

  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_SECONDS * 1000;
  const current = (memoryRateLimiter.get(requesterId) ?? []).filter(
    timestamp => timestamp > windowStart
  );
  current.push(now);
  memoryRateLimiter.set(requesterId, current);
  return current.length > RATE_LIMIT_MAX;
}

export async function incrementReaction(
  streamId: string,
  emoji: ReactionEmoji
): Promise<void> {
  const redis = await getUpstashRedis();

  if (redis) {
    await redis.incr(getReactionKey(streamId, emoji));
    await redis.del(getReactionCacheKey(streamId));
    return;
  }

  const current = getCachedMemorySummary(streamId) ?? {
    reactions: {},
    total: 0,
  };
  current.reactions[emoji] = (current.reactions[emoji] ?? 0) + 1;
  current.total += 1;
  setCachedMemorySummary(streamId, current);
}

export async function getReactionSummary(
  streamId: string
): Promise<ReactionSummary> {
  const redis = await getUpstashRedis();

  if (redis) {
    const cacheKey = getReactionCacheKey(streamId);
    const cached = await redis.get<ReactionSummary>(cacheKey);
    if (cached) {
      return cached;
    }

    const counts = await Promise.all(
      REACTIONS.map(async emoji => {
        const value = await redis.get<number>(getReactionKey(streamId, emoji));
        return [emoji, Number(value ?? 0)] as const;
      })
    );

    const reactions = counts.reduce<ReactionCounts>((acc, [emoji, count]) => {
      if (count > 0) {
        acc[emoji] = count;
      }
      return acc;
    }, {});

    const total = counts.reduce((sum, [, count]) => sum + count, 0);
    const summary = { reactions, total };

    await redis.set(cacheKey, summary, { ex: CACHE_TTL_SECONDS });
    return summary;
  }

  const cached = getCachedMemorySummary(streamId);
  return cached ?? { reactions: {}, total: 0 };
}

export async function aggregateAndFlushStreamReactions(
  streamSessionId: string
): Promise<ReactionSummary> {
  await ensureStreamReactionColumns();

  const summary = await getReactionSummary(streamSessionId);

  await sql`
    UPDATE stream_sessions
    SET
      reaction_counts = ${JSON.stringify(summary.reactions)}::jsonb,
      reaction_total = ${summary.total},
      ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP)
    WHERE id = ${streamSessionId}
  `;

  const redis = await getUpstashRedis();
  if (redis) {
    const keys = REACTIONS.map(emoji => getReactionKey(streamSessionId, emoji));
    await redis.del(...keys, getReactionCacheKey(streamSessionId));
  }

  memoryCache.delete(streamSessionId);
  return summary;
}
