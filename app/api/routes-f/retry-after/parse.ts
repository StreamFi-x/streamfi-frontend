import type { RetryAfterResponse } from './types';

const INTEGER_SECONDS_PATTERN = /^\d+$/;

export function parseRetryAfterValue(
  header: string,
  nowIso?: string
): RetryAfterResponse | null {
  const now = nowIso ? new Date(nowIso) : new Date();
  if (nowIso && Number.isNaN(now.valueOf())) {
    return null;
  }

  const trimmed = header.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (INTEGER_SECONDS_PATTERN.test(trimmed)) {
    const delay = Number(trimmed);
    if (!Number.isFinite(delay) || delay < 0) {
      return null;
    }

    const retryAt = new Date(now.getTime() + delay * 1000);
    return {
      delay_seconds: delay,
      retry_at: retryAt.toISOString(),
    };
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }

  const retryAt = new Date(parsed);
  const delaySeconds = Math.max(0, Math.ceil((retryAt.getTime() - now.getTime()) / 1000));

  return {
    delay_seconds: delaySeconds,
    retry_at: retryAt.toISOString(),
  };
}
