const CAPACITY = 10;
const WINDOW_MS = 60_000;
const REFILL_RATE_PER_MS = CAPACITY / WINDOW_MS;

interface BucketState {
  tokens: number;
  last_refill_ms: number;
}

interface ConsumeTokenResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retry_after_seconds: number;
  reset_epoch_seconds: number;
}

const buckets = new Map<string, BucketState>();

function getBucket(ip: string, nowMs: number): BucketState {
  const existing = buckets.get(ip);
  if (existing) {
    return existing;
  }

  const freshBucket: BucketState = {
    tokens: CAPACITY,
    last_refill_ms: nowMs,
  };
  buckets.set(ip, freshBucket);
  return freshBucket;
}

function refillBucket(bucket: BucketState, nowMs: number) {
  const elapsedMs = Math.max(0, nowMs - bucket.last_refill_ms);
  if (elapsedMs === 0) {
    return;
  }

  bucket.tokens = Math.min(
    CAPACITY,
    bucket.tokens + elapsedMs * REFILL_RATE_PER_MS
  );
  bucket.last_refill_ms = nowMs;
}

export function consumeToken(
  ip: string,
  nowMs: number = Date.now()
): ConsumeTokenResult {
  const bucket = getBucket(ip, nowMs);
  refillBucket(bucket, nowMs);

  const allowed = bucket.tokens >= 1;
  if (allowed) {
    bucket.tokens -= 1;
  }

  const tokensToNextRequest = Math.max(0, 1 - bucket.tokens);
  const missingTokensToFull = Math.max(0, CAPACITY - bucket.tokens);
  const retryAfterSeconds = Math.ceil(
    (tokensToNextRequest / REFILL_RATE_PER_MS) / 1000
  );
  const resetEpochSeconds = Math.ceil(
    (nowMs + missingTokensToFull / REFILL_RATE_PER_MS) / 1000
  );

  return {
    allowed,
    limit: CAPACITY,
    remaining: Math.max(0, Math.floor(bucket.tokens)),
    retry_after_seconds: retryAfterSeconds,
    reset_epoch_seconds: resetEpochSeconds,
  };
}

export function getRequestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") ?? "127.0.0.1";
}

export function __resetTokenBuckets() {
  buckets.clear();
}
