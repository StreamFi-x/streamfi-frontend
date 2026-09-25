import type { ChatMessage } from "@/types/chat";

/**
 * The chat poll is served from a shared cache that can be ~2s behind the
 * database (chatWindow policy in lib/cache/policy.ts). A client that just
 * sent or deleted a message would otherwise see it vanish or reappear on the
 * next poll. We remember this client's own writes long enough for the shared
 * window to catch up and overlay them on each fetched window.
 */
export const RECENT_WRITE_TTL_MS = 5000;

export interface RecentWrites {
  sent: { message: ChatMessage; expiresAt: number }[];
  deleted: Map<number, number>;
}

const byStream = new Map<string, RecentWrites>();

export function recentWritesFor(playbackId: string): RecentWrites {
  let writes = byStream.get(playbackId);
  if (!writes) {
    writes = { sent: [], deleted: new Map() };
    byStream.set(playbackId, writes);
  }
  return writes;
}

export function rememberSent(
  writes: RecentWrites,
  message: ChatMessage,
  now = Date.now()
): void {
  writes.sent.push({ message, expiresAt: now + RECENT_WRITE_TTL_MS });
}

export function rememberDeleted(
  writes: RecentWrites,
  id: number,
  now = Date.now()
): void {
  writes.deleted.set(id, now + RECENT_WRITE_TTL_MS);
}

export function reconcileWithRecentWrites(
  fetched: ChatMessage[],
  writes: RecentWrites | undefined,
  now = Date.now()
): ChatMessage[] {
  if (!writes) {
    return fetched;
  }
  writes.sent = writes.sent.filter(entry => entry.expiresAt > now);
  for (const [id, expiresAt] of writes.deleted) {
    if (expiresAt <= now) {
      writes.deleted.delete(id);
    }
  }
  if (writes.sent.length === 0 && writes.deleted.size === 0) {
    return fetched;
  }

  const fetchedIds = new Set(fetched.map(m => m.id));
  const merged = fetched.filter(m => !writes.deleted.has(m.id));
  const missing = writes.sent
    .map(entry => entry.message)
    .filter(m => !fetchedIds.has(m.id) && !writes.deleted.has(m.id));
  if (missing.length === 0) {
    return merged;
  }
  return [...merged, ...missing].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
  );
}
