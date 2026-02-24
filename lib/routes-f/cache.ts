interface CacheEntry {
  body: string;
  contentType: string;
  expiresAt: number;
}

const cacheStore = new Map<string, CacheEntry>();

const DEFAULT_TTL_SECONDS = 60;

function parseEnvNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function isCacheEnabled() {
  return process.env.ROUTES_F_CACHE_ENABLED === "true";
}

export function getCacheTtlSeconds() {
  return parseEnvNumber(
    process.env.ROUTES_F_CACHE_TTL_SECONDS,
    DEFAULT_TTL_SECONDS
  );
}

export function buildCacheKey(routeKey: string, params: Record<string, string | undefined>) {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const search = new URLSearchParams(entries as string[][]).toString();
  return `${routeKey}?${search}`;
}

export function getCachedEntry(key: string, now = Date.now()) {
  const entry = cacheStore.get(key);
  if (!entry) {
    return null;
  }
  if (now > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  return entry;
}

export function setCachedEntry(
  key: string,
  body: string,
  contentType: string,
  now = Date.now()
) {
  const ttlSeconds = getCacheTtlSeconds();
  cacheStore.set(key, {
    body,
    contentType,
    expiresAt: now + ttlSeconds * 1000,
  });
}

export function applyCacheHeaders(headers: Headers, status: "HIT" | "MISS", enabled: boolean) {
  headers.set("X-Cache-Enabled", enabled ? "true" : "false");
  if (enabled) {
    headers.set("X-Cache", status);
  }
}

export function __test__resetCache() {
  cacheStore.clear();
}
