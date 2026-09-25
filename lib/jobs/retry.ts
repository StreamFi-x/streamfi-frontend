export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  isRetryable: (err: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Bounded retry with exponential backoff and jitter. Permanent errors
 * (isRetryable returns false) are rethrown immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts, baseDelayMs, isRetryable, sleep = defaultSleep }: RetryOptions
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === attempts - 1) {
        throw err;
      }
      const backoff = baseDelayMs * 2 ** attempt;
      await sleep(backoff + Math.floor(Math.random() * baseDelayMs));
    }
  }
  throw lastError;
}

/** Wall-clock budget for a job invocation (serverless functions have a hard limit). */
export function createDeadline(budgetMs: number, now: () => number = Date.now) {
  const endsAt = now() + budgetMs;
  return {
    expired: () => now() >= endsAt,
  };
}
