/**
 * lib/realtime/redis-subscriber.ts
 *
 * Cross-instance Redis history poller for the SSE endpoint.
 * In a serverless environment each instance only receives messages published
 * to its own in-memory bus. This poller bridges the gap: it periodically reads
 * from the Redis history list (written by publishRealtimeMessage) and delivers
 * messages that arrived on other instances to this connection's handler.
 */

import { getUpstashRedis } from "@/lib/upstash-redis";
import type { RealtimeMessage } from "@/lib/realtime/pubsub";

/**
 * Start a periodic poll of the Redis history list for `channel`.
 * Delivers only messages with seq > the last one already seen.
 * Cleans up automatically when `signal` fires.
 *
 * If Redis is not configured (local dev / tests), returns immediately without
 * starting the interval — the in-memory subscribeLocal path is sufficient.
 */
export function startRedisChannelPoller(
  channel: string,
  handler: (msg: RealtimeMessage) => void,
  signal: AbortSignal
): void {
  const redis = getUpstashRedis();
  if (!redis) {
    return;
  }

  let lastSeq = 0;

  const interval = setInterval(async () => {
    try {
      const listKey = `realtime:history:${channel}`;
      const raw = await redis.lrange(listKey, 0, 49);
      if (!raw || !Array.isArray(raw) || raw.length === 0) {
        return;
      }

      const messages: RealtimeMessage[] = raw
        .map((item) => {
          try {
            return typeof item === "string" ? JSON.parse(item) : (item as RealtimeMessage);
          } catch {
            return null;
          }
        })
        .filter((m): m is RealtimeMessage => m !== null && typeof m.seq === "number");

      const newMessages = messages
        .filter((m) => m.seq > lastSeq)
        .sort((a, b) => a.seq - b.seq);

      for (const msg of newMessages) {
        handler(msg);
        if (msg.seq > lastSeq) {
          lastSeq = msg.seq;
        }
      }
    } catch {
      // Swallow errors silently — a transient Redis failure should not crash
      // the SSE connection.
    }
  }, 1000);

  signal.addEventListener("abort", () => {
    clearInterval(interval);
  });
}
