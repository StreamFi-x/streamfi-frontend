/**
 * lib/realtime/pubsub.ts
 *
 * Realtime Pub/Sub backbone supporting serverless/edge environments.
 * Uses Upstash Redis when configured, with an in-memory broadcast fallback
 * for local dev and automated tests.
 */

import { getUpstashRedis } from "@/lib/upstash-redis";
import { logger } from "@/lib/tracing/logger";

export interface RealtimeMessage<T = any> {
  id: string;
  channel: string;
  event: string;
  data: T;
  seq: number;
  timestamp: number;
}

// In-memory channel bus for single-instance or local testing environments
const localChannelHistory = new Map<string, RealtimeMessage[]>();
const localSubscribers = new Map<string, Set<(msg: RealtimeMessage) => void>>();
const channelSequenceCounters = new Map<string, number>();

const MAX_HISTORY_PER_CHANNEL = 50;
const CHANNEL_TTL_SECONDS = 3600; // 1 hour retention in Redis for recent reconnect catch-up

/**
 * Generate a sequential sequence number per channel.
 */
async function nextSequence(channel: string): Promise<number> {
  const redis = getUpstashRedis();
  if (redis) {
    try {
      const seq = await redis.incr(`realtime:seq:${channel}`);
      return seq;
    } catch (err) {
      logger.warn("Failed to increment Redis sequence counter, using local fallback", {
        channel,
        error: String(err),
      });
    }
  }

  const current = channelSequenceCounters.get(channel) || 0;
  const next = current + 1;
  channelSequenceCounters.set(channel, next);
  return next;
}

/**
 * Publish an event to a realtime channel.
 */
export async function publishRealtimeMessage<T = any>(
  channel: string,
  event: string,
  data: T
): Promise<RealtimeMessage<T>> {
  const seq = await nextSequence(channel);
  const message: RealtimeMessage<T> = {
    id: `${channel}-${seq}-${Date.now()}`,
    channel,
    event,
    data,
    seq,
    timestamp: Date.now(),
  };

  const redis = getUpstashRedis();
  if (redis) {
    try {
      // Store in a capped list for replay on client reconnection
      const listKey = `realtime:history:${channel}`;
      await redis.lpush(listKey, JSON.stringify(message));
      await redis.ltrim(listKey, 0, MAX_HISTORY_PER_CHANNEL - 1);
      await redis.expire(listKey, CHANNEL_TTL_SECONDS);

      // Publish notification key for active listeners
      await redis.publish(`realtime:channel:${channel}`, JSON.stringify(message));
    } catch (err) {
      logger.warn("Failed to publish message to Redis pub/sub", {
        channel,
        event,
        error: String(err),
      });
    }
  }

  // Also dispatch locally (for single process, testing, and memory listeners)
  let history = localChannelHistory.get(channel);
  if (!history) {
    history = [];
    localChannelHistory.set(channel, history);
  }
  history.unshift(message);
  if (history.length > MAX_HISTORY_PER_CHANNEL) {
    history.pop();
  }

  const listeners = localSubscribers.get(channel);
  if (listeners) {
    for (const listener of listeners) {
      try {
        listener(message);
      } catch (err) {
        console.error("[realtime] Listener threw error:", err);
      }
    }
  }

  return message;
}

/**
 * Fetch recent messages on a channel for reconnection gap recovery.
 */
export async function getRecentMessages(
  channel: string,
  sinceSeq?: number
): Promise<RealtimeMessage[]> {
  const redis = getUpstashRedis();
  if (redis) {
    try {
      const listKey = `realtime:history:${channel}`;
      const raw = await redis.lrange(listKey, 0, MAX_HISTORY_PER_CHANNEL - 1);
      if (raw && Array.isArray(raw)) {
        const messages: RealtimeMessage[] = raw
          .map((item) => (typeof item === "string" ? JSON.parse(item) : item))
          .reverse();

        if (sinceSeq !== undefined && sinceSeq > 0) {
          return messages.filter((m) => m.seq > sinceSeq);
        }
        return messages;
      }
    } catch (err) {
      logger.warn("Failed to read history from Redis, using local fallback", {
        channel,
        error: String(err),
      });
    }
  }

  const localHistory = localChannelHistory.get(channel) || [];
  const ordered = [...localHistory].reverse();
  if (sinceSeq !== undefined && sinceSeq > 0) {
    return ordered.filter((m) => m.seq > sinceSeq);
  }
  return ordered;
}

/**
 * Subscribe to local in-memory channel events.
 */
export function subscribeLocal(
  channel: string,
  handler: (msg: RealtimeMessage) => void
): () => void {
  let set = localSubscribers.get(channel);
  if (!set) {
    set = new Set();
    localSubscribers.set(channel, set);
  }
  set.add(handler);

  return () => {
    set?.delete(handler);
    if (set?.size === 0) {
      localSubscribers.delete(channel);
    }
  };
}

/**
 * Reset local channels (for unit tests).
 */
export function resetRealtimeForTests(): void {
  localChannelHistory.clear();
  localSubscribers.clear();
  channelSequenceCounters.clear();
}
