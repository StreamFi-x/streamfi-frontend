type SnapshotCacheEntry = {
  url: string;
  generatedAt: string;
  expiresAt: number;
};

const snapshotCache = new Map<string, SnapshotCacheEntry>();
const snapshotRateLimit = new Map<string, number>();

export function getSnapshot(playbackId: string): SnapshotCacheEntry | null {
  const entry = snapshotCache.get(playbackId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    snapshotCache.delete(playbackId);
    return null;
  }
  return entry;
}

export function setSnapshot(playbackId: string, url: string, ttlMs: number) {
  const generatedAt = new Date().toISOString();
  snapshotCache.set(playbackId, {
    url,
    generatedAt,
    expiresAt: Date.now() + ttlMs,
  });
  return { url, generatedAt };
}

export function canRequestSnapshot(key: string, windowMs: number) {
  const lastRequestAt = snapshotRateLimit.get(key) ?? 0;
  const remainingMs = windowMs - (Date.now() - lastRequestAt);

  if (remainingMs > 0) {
    return { allowed: false, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
  }

  snapshotRateLimit.set(key, Date.now());
  return { allowed: true, retryAfterSeconds: 0 };
}
