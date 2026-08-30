import type { TimeoutEntry, TimeoutListItem } from "./types";

// Key: "stream_id:user_id"
export const timeoutStore = new Map<string, TimeoutEntry>();

function key(stream_id: string, user_id: string): string {
  return `${stream_id}:${user_id}`;
}

export function applyTimeout(
  stream_id: string,
  user_id: string,
  seconds: number,
  reason?: string
): { expires_at: string } {
  const expires_at = new Date(Date.now() + seconds * 1000).toISOString();
  const entry: TimeoutEntry = { stream_id, user_id, reason, expires_at };
  timeoutStore.set(key(stream_id, user_id), entry);
  return { expires_at };
}

export function liftTimeout(stream_id: string, user_id: string): boolean {
  return timeoutStore.delete(key(stream_id, user_id));
}

export function listActiveTimeouts(stream_id: string): TimeoutListItem[] {
  const now = Date.now();
  const results: TimeoutListItem[] = [];

  for (const [k, entry] of timeoutStore) {
    if (entry.stream_id !== stream_id) {continue;}

    const expiresMs = new Date(entry.expires_at).getTime();
    const remaining = Math.ceil((expiresMs - now) / 1000);

    if (remaining <= 0) {
      timeoutStore.delete(k);
      continue;
    }

    results.push({
      user_id: entry.user_id,
      reason: entry.reason,
      expires_at: entry.expires_at,
      seconds_remaining: remaining,
    });
  }

  return results;
}
