/**
 * lib/realtime/presence.ts
 *
 * Heartbeat-backed live viewer presence system (#1133, #1134).
 *
 * Solves viewer-count drift from ungraceful client disconnects (tab closes, browser crashes)
 * by deriving active presence from TTL-backed heartbeat entries instead of relying solely on
 * client DELETE requests.
 *
 * Backed by Redis sorted sets (or in-memory store in local dev/tests).
 */

import { getUpstashRedis } from "@/lib/upstash-redis";
import { publishRealtimeMessage } from "@/lib/realtime/pubsub";
import { logger } from "@/lib/tracing/logger";

export const PRESENCE_HEARTBEAT_TTL_SECONDS = 60;
export const MAX_PRESENCE_DISPLAY_LIMIT = 100;

export interface ViewerPresenceInput {
  sessionId: string;
  userId?: string | null;
  username?: string | null;
  avatar?: string | null;
  isAnonymous?: boolean;
}

export interface ViewerIdentity {
  sessionId: string;
  userId?: string | null;
  username: string;
  avatar?: string | null;
  joinedAt: number;
  lastHeartbeatAt: number;
}

export interface StreamPresenceSnapshot {
  streamId: string;
  totalViewers: number;
  authenticatedViewers: ViewerIdentity[];
  anonymousCount: number;
  sampled: boolean;
  timestamp: number;
}

interface InMemViewerEntry {
  viewer: ViewerIdentity;
  expiresAt: number;
}

// In-memory fallback for environments without Redis
const inMemoryPresence = new Map<string, Map<string, InMemViewerEntry>>();

function getPresenceKey(streamId: string): string {
  return `stream:${streamId}:presence_set`;
}

function getPresenceDetailKey(streamId: string): string {
  return `stream:${streamId}:presence_details`;
}

/**
 * Record or refresh a viewer's presence heartbeat.
 */
export async function recordViewerHeartbeat(
  streamId: string,
  input: ViewerPresenceInput
): Promise<StreamPresenceSnapshot> {
  const now = Date.now();
  const expiresAt = now + PRESENCE_HEARTBEAT_TTL_SECONDS * 1000;
  const isAnon = input.isAnonymous || !input.userId;

  const viewerIdentity: ViewerIdentity = {
    sessionId: input.sessionId,
    userId: input.userId ?? null,
    username: isAnon ? "Anonymous Viewer" : input.username || "Viewer",
    avatar: isAnon ? null : input.avatar ?? null,
    joinedAt: now,
    lastHeartbeatAt: now,
  };

  const redis = getUpstashRedis();
  if (redis) {
    try {
      const zkey = getPresenceKey(streamId);
      const hkey = getPresenceDetailKey(streamId);

      // Score is expiry timestamp in milliseconds
      await redis.zadd(zkey, { score: expiresAt, member: input.sessionId });
      if (!isAnon) {
        await redis.hset(hkey, { [input.sessionId]: JSON.stringify(viewerIdentity) });
      }

      // Expire keys older than now
      await redis.zremrangebyscore(zkey, 0, now);
    } catch (err) {
      logger.warn("Redis presence heartbeat error, using in-memory store", {
        streamId,
        error: String(err),
      });
    }
  }

  // Update in-memory map
  let streamMap = inMemoryPresence.get(streamId);
  if (!streamMap) {
    streamMap = new Map();
    inMemoryPresence.set(streamId, streamMap);
  }

  const existing = streamMap.get(input.sessionId);
  if (existing) {
    viewerIdentity.joinedAt = existing.viewer.joinedAt;
  }
  streamMap.set(input.sessionId, { viewer: viewerIdentity, expiresAt });

  // Clean expired in-memory entries
  for (const [sid, entry] of streamMap.entries()) {
    if (entry.expiresAt < now) {
      streamMap.delete(sid);
    }
  }

  const snapshot = await getLivePresence(streamId);

  // Broadcast presence update over realtime channel
  publishRealtimeMessage(`stream:${streamId}:presence`, "presence:update", {
    totalViewers: snapshot.totalViewers,
    anonymousCount: snapshot.anonymousCount,
    authenticatedCount: snapshot.authenticatedViewers.length,
    timestamp: snapshot.timestamp,
  }).catch(() => {});

  return snapshot;
}

/**
 * Explicitly remove a viewer's presence on clean leave.
 */
export async function removeViewerPresence(
  streamId: string,
  sessionId: string
): Promise<void> {
  const redis = getUpstashRedis();
  if (redis) {
    try {
      await redis.zrem(getPresenceKey(streamId), sessionId);
      await redis.hdel(getPresenceDetailKey(streamId), sessionId);
    } catch (err) {
      logger.warn("Redis removeViewerPresence error", { streamId, error: String(err) });
    }
  }

  const streamMap = inMemoryPresence.get(streamId);
  if (streamMap) {
    streamMap.delete(sessionId);
  }

  const snapshot = await getLivePresence(streamId);
  publishRealtimeMessage(`stream:${streamId}:presence`, "presence:update", {
    totalViewers: snapshot.totalViewers,
    anonymousCount: snapshot.anonymousCount,
    authenticatedCount: snapshot.authenticatedViewers.length,
    timestamp: snapshot.timestamp,
  }).catch(() => {});
}

/**
 * Query current active presence for a stream.
 * Automatically filters out expired TTL entries.
 * Enforces capping/sampling for high-concurrency streams (#1133).
 */
export async function getLivePresence(
  streamId: string,
  options: { limit?: number } = {}
): Promise<StreamPresenceSnapshot> {
  const now = Date.now();
  const limit = options.limit ?? MAX_PRESENCE_DISPLAY_LIMIT;

  const redis = getUpstashRedis();
  if (redis) {
    try {
      const zkey = getPresenceKey(streamId);
      const hkey = getPresenceDetailKey(streamId);

      // Clean stale entries
      await redis.zremrangebyscore(zkey, 0, now);

      // Count total live sessions
      const totalViewers = await redis.zcount(zkey, now, "+inf");
      const activeSessionIds: string[] = await redis.zrange(zkey, now, "+inf", {
        byScore: true,
        offset: 0,
        count: limit,
      });

      let authenticatedViewers: ViewerIdentity[] = [];
      let anonymousCount = totalViewers;

      if (activeSessionIds.length > 0) {
        const rawDetails: Record<string, string> =
          (await redis.hmget(hkey, ...activeSessionIds)) || {};

        for (const sid of activeSessionIds) {
          const raw = rawDetails[sid];
          if (raw) {
            try {
              authenticatedViewers.push(JSON.parse(raw));
            } catch {}
          }
        }
        anonymousCount = Math.max(0, totalViewers - authenticatedViewers.length);
      }

      return {
        streamId,
        totalViewers,
        authenticatedViewers: authenticatedViewers.slice(0, limit),
        anonymousCount,
        sampled: totalViewers > limit,
        timestamp: now,
      };
    } catch (err) {
      logger.warn("Redis getLivePresence error, using in-memory fallback", {
        streamId,
        error: String(err),
      });
    }
  }

  // In-memory fallback
  const streamMap = inMemoryPresence.get(streamId) || new Map();
  const activeViewers: ViewerIdentity[] = [];
  let anonymousCount = 0;

  for (const [sid, entry] of streamMap.entries()) {
    if (entry.expiresAt >= now) {
      if (entry.viewer.userId) {
        activeViewers.push(entry.viewer);
      } else {
        anonymousCount++;
      }
    } else {
      streamMap.delete(sid);
    }
  }

  const totalViewers = activeViewers.length + anonymousCount;

  return {
    streamId,
    totalViewers,
    authenticatedViewers: activeViewers.slice(0, limit),
    anonymousCount,
    sampled: totalViewers > limit,
    timestamp: now,
  };
}

/**
 * Reset presence state for test suites.
 */
export function resetPresenceForTests(): void {
  inMemoryPresence.clear();
}
