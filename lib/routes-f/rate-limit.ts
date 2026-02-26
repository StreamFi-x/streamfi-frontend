interface RateLimitState {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitState>();

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_SECONDS = 60;

function parseEnvNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return (
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function checkRateLimit(params: {
  headers: Headers;
  routeKey: string;
  now?: number;
}) {
  const limit = parseEnvNumber(
    process.env.ROUTES_F_RATE_LIMIT,
    DEFAULT_LIMIT
  );
  const windowSeconds = parseEnvNumber(
    process.env.ROUTES_F_RATE_LIMIT_WINDOW_SECONDS,
    DEFAULT_WINDOW_SECONDS
  );
  const now = params.now ?? Date.now();
  const resetAt = now + windowSeconds * 1000;

  const ip = getClientIp(params.headers);
  const key = `${ip}:${params.routeKey}`;

  const existing = rateLimitStore.get(key);

  if (!existing || now > existing.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt,
      retryAfterSeconds: 0,
      policy: "fixed-window",
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000)
      ),
      policy: "fixed-window",
    };
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
    policy: "fixed-window",
  };
}

export function applyRateLimitHeaders(headers: Headers, info: {
  limit: number;
  remaining: number;
  resetAt: number;
  policy: string;
}) {
  headers.set("X-RateLimit-Limit", String(info.limit));
  headers.set("X-RateLimit-Remaining", String(info.remaining));
  headers.set(
    "X-RateLimit-Reset",
    Math.ceil(info.resetAt / 1000).toString()
  );
  headers.set("X-RateLimit-Policy", info.policy);
}

export function __test__resetRateLimit() {
  rateLimitStore.clear();
}
