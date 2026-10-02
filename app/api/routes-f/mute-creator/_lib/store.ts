import type { MuteRecord } from "./types";

// Keyed by `${follower_id}:${creator_id}` for O(1) lookups
const mutes = new Map<string, MuteRecord>();

function muteKey(followerId: string, creatorId: string): string {
  return `${followerId}:${creatorId}`;
}

export function muteCreator(
  followerId: string,
  creatorId: string,
): { ok: true; record: MuteRecord } | { ok: false; error: string; status: number } {
  if (followerId === creatorId) {
    return { ok: false, error: "A user cannot mute themselves.", status: 400 };
  }

  const key = muteKey(followerId, creatorId);
  if (mutes.has(key)) {
    return { ok: false, error: "Creator is already muted.", status: 409 };
  }

  const record: MuteRecord = {
    follower_id: followerId,
    creator_id: creatorId,
    muted_at: new Date().toISOString(),
  };

  mutes.set(key, record);
  return { ok: true, record };
}

export function unmuteCreator(
  followerId: string,
  creatorId: string,
): { ok: true } | { ok: false; error: string; status: number } {
  const key = muteKey(followerId, creatorId);
  if (!mutes.has(key)) {
    return { ok: false, error: "Mute record not found.", status: 404 };
  }
  mutes.delete(key);
  return { ok: true };
}

export function listMutedCreators(followerId: string): MuteRecord[] {
  return Array.from(mutes.values())
    .filter((r) => r.follower_id === followerId)
    .sort((a, b) => a.muted_at.localeCompare(b.muted_at));
}

export function __resetMuteStore(): void {
  mutes.clear();
}
