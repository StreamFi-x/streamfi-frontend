import type { FeatureFlag } from "./types";

// In-memory store scoped to this folder (module singleton)
const flags = new Map<string, FeatureFlag>();

export function getAll(): FeatureFlag[] {
  return Array.from(flags.values());
}

export function getOne(key: string): FeatureFlag | undefined {
  return flags.get(key);
}

export function upsert(flag: FeatureFlag): void {
  flags.set(flag.key, flag);
}

export function remove(key: string): boolean {
  return flags.delete(key);
}

/**
 * Deterministic percentage-rollout check.
 *
 * Produces a stable 0–99 bucket for (userId, flagKey) using a simple djb2-style
 * hash so the same user always lands in the same bucket.
 */
export function isEnabledForUser(flag: FeatureFlag, userId: string): boolean {
  if (!flag.enabled) return false;
  if (flag.rollout_percent >= 100) return true;
  if (flag.rollout_percent <= 0) return false;

  const seed = `${flag.key}:${userId}`;
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return (hash % 100) < flag.rollout_percent;
}
