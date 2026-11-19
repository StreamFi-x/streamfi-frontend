import { getUpstashRedis } from "@/lib/upstash-redis";

/**
 * Spike level for a stream's chat load.
 * - normal:   below warning threshold
 * - degraded: ≥ CHAT_SPIKE_THRESHOLD_WARN msgs/60s
 * - critical: ≥ CHAT_SPIKE_THRESHOLD_CRITICAL msgs/60s
 */
export type SpikeLevel = "normal" | "degraded" | "critical";

function getWarnThreshold(): number {
  return parseInt(process.env.CHAT_SPIKE_THRESHOLD_WARN ?? "500", 10);
}

function getCriticalThreshold(): number {
  return parseInt(process.env.CHAT_SPIKE_THRESHOLD_CRITICAL ?? "2000", 10);
}

function getConnThreshold(): number {
  return parseInt(process.env.CHAT_CONN_SPIKE_THRESHOLD ?? "1000", 10);
}

function countToLevel(count: number): SpikeLevel {
  if (count >= getCriticalThreshold()) return "critical";
  if (count >= getWarnThreshold()) return "degraded";
  return "normal";
}

/**
 * Increments the per-stream message-rate counter (60 s rolling window), derives
 * the current SpikeLevel, persists it in Redis with a 90 s TTL (auto-recovery),
 * and returns the level.
 *
 * If Redis is unavailable or any error occurs, returns 'normal' so the app
 * degrades gracefully rather than throwing.
 */
export async function recordAndGetSpikeLevel(
  streamerId: string
): Promise<SpikeLevel> {
  const redis = getUpstashRedis();
  if (!redis) return "normal";

  try {
    const rateKey = `chat:msgrate:${streamerId}`;
    const levelKey = `chat:spikelevel:${streamerId}`;

    // INCR increments the key by 1. On the very first call the key is created
    // with value 1; we then set its TTL to 60 s so it acts as a sliding window.
    const count = await redis.incr(rateKey);
    if (count === 1) {
      // First message in this window — start the 60-second TTL.
      await redis.expire(rateKey, 60);
    }

    const newLevel = countToLevel(count);

    // Store level with a 90-second TTL. When load drops, the level key auto-
    // expires → next read returns null → treated as 'normal' (auto-recovery).
    await redis.set(levelKey, newLevel, { ex: 90 });

    return newLevel;
  } catch {
    return "normal";
  }
}

/**
 * Reads the spike level from Redis without incrementing any counter.
 * Returns 'normal' when the key is absent (TTL expired → stream recovered)
 * or when Redis is unavailable.
 */
export async function getSpikeLevelForStream(
  streamerId: string
): Promise<SpikeLevel> {
  const redis = getUpstashRedis();
  if (!redis) return "normal";

  try {
    const raw = await redis.get<string>(`chat:spikelevel:${streamerId}`);
    if (raw === "degraded" || raw === "critical") return raw;
    return "normal";
  } catch {
    return "normal";
  }
}

/**
 * Increments the per-stream connection-rate counter (60 s rolling window).
 * Returns the SpikeLevel implied by the connection count alone.
 *
 * Used by the GET /api/streams/chat handler to separately track viewer
 * reconnect/poll rate, which is a leading indicator of load (connections spike
 * before messages do when viewers join a viral stream).
 */
export async function recordConnectionRate(
  streamerId: string
): Promise<SpikeLevel> {
  const redis = getUpstashRedis();
  if (!redis) return "normal";

  try {
    const key = `chat:connrate:${streamerId}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60);
    }
    const connThreshold = getConnThreshold();
    // Connection threshold maps to a single level: above threshold → degraded.
    // We don't have a separate "critical" tier for connections alone.
    return count >= connThreshold ? "degraded" : "normal";
  } catch {
    return "normal";
  }
}

/**
 * Returns the effective slow-mode interval in seconds, accounting for the
 * current spike level. The configured value is never lowered — only raised.
 *
 * - normal:   configuredSeconds (no change)
 * - degraded: max(configuredSeconds, 5)
 * - critical: max(configuredSeconds, 15)
 */
export function getEffectiveSlowMode(
  configuredSeconds: number,
  level: SpikeLevel
): number {
  if (level === "critical") return Math.max(configuredSeconds, 15);
  if (level === "degraded") return Math.max(configuredSeconds, 5);
  return configuredSeconds;
}

/**
 * Returns the recommended chat-poll interval in seconds for each spike level.
 * Clients read this from the X-Poll-Interval response header.
 *
 * - normal:   3 s
 * - degraded: 10 s
 * - critical: 30 s
 */
export function getPollIntervalSeconds(level: SpikeLevel): number {
  if (level === "critical") return 30;
  if (level === "degraded") return 10;
  return 3;
}

/**
 * Returns true when the spike level is critical, meaning cosmetic typing
 * indicators and presence updates should be shed to reduce load.
 */
export function shouldShedTypingIndicators(level: SpikeLevel): boolean {
  return level === "critical";
}
