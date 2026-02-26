export type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreakerEntry {
  state: CircuitState;
  failures: number;
  openedAt: number | null;
}

export interface CircuitBreakerConfig {
  failureThreshold?: number;
  cooldownMs?: number;
}

export interface CircuitBreakerRunOptions<T> extends CircuitBreakerConfig {
  key: string;
  now?: number;
  action: () => Promise<T>;
}

export type CircuitBreakerResult<T> =
  | {
      ok: true;
      value: T;
      state: CircuitState;
      failures: number;
      shortCircuited: false;
      retryAfterMs: 0;
    }
  | {
      ok: false;
      error?: unknown;
      state: CircuitState;
      failures: number;
      shortCircuited: boolean;
      retryAfterMs: number;
    };

const DEFAULT_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 30_000;
const breakerStore = new Map<string, CircuitBreakerEntry>();

function getThreshold(value: number | undefined): number {
  if (Number.isFinite(value) && (value as number) > 0) {
    return Math.floor(value as number);
  }

  const envValue = Number(process.env.ROUTES_F_CIRCUIT_BREAKER_THRESHOLD);
  return Number.isFinite(envValue) && envValue > 0
    ? Math.floor(envValue)
    : DEFAULT_THRESHOLD;
}

function getCooldownMs(value: number | undefined): number {
  if (Number.isFinite(value) && (value as number) > 0) {
    return Math.floor(value as number);
  }

  const envValue = Number(process.env.ROUTES_F_CIRCUIT_BREAKER_COOLDOWN_MS);
  return Number.isFinite(envValue) && envValue > 0
    ? Math.floor(envValue)
    : DEFAULT_COOLDOWN_MS;
}

function getOrCreateEntry(key: string): CircuitBreakerEntry {
  const existing = breakerStore.get(key);

  if (existing) {
    return existing;
  }

  const created: CircuitBreakerEntry = {
    state: "closed",
    failures: 0,
    openedAt: null,
  };
  breakerStore.set(key, created);
  return created;
}

function remainingCooldown(openedAt: number, now: number, cooldownMs: number): number {
  return Math.max(0, openedAt + cooldownMs - now);
}

function toOpen(entry: CircuitBreakerEntry, now: number): void {
  entry.state = "open";
  entry.openedAt = now;
}

export async function runWithCircuitBreaker<T>(
  options: CircuitBreakerRunOptions<T>
): Promise<CircuitBreakerResult<T>> {
  const now = options.now ?? Date.now();
  const threshold = getThreshold(options.failureThreshold);
  const cooldownMs = getCooldownMs(options.cooldownMs);
  const entry = getOrCreateEntry(options.key);

  if (entry.state === "open") {
    const openedAt = entry.openedAt ?? now;
    const retryAfterMs = remainingCooldown(openedAt, now, cooldownMs);

    if (retryAfterMs > 0) {
      return {
        ok: false,
        state: "open",
        failures: entry.failures,
        shortCircuited: true,
        retryAfterMs,
      };
    }

    entry.state = "half-open";
  }

  try {
    const value = await options.action();
    entry.state = "closed";
    entry.failures = 0;
    entry.openedAt = null;

    return {
      ok: true,
      value,
      state: "closed",
      failures: 0,
      shortCircuited: false,
      retryAfterMs: 0,
    };
  } catch (error) {
    entry.failures += 1;

    const shouldOpen = entry.state === "half-open" || entry.failures >= threshold;

    if (shouldOpen) {
      toOpen(entry, now);
      return {
        ok: false,
        error,
        state: "open",
        failures: entry.failures,
        shortCircuited: false,
        retryAfterMs: cooldownMs,
      };
    }

    entry.state = "closed";
    return {
      ok: false,
      error,
      state: "closed",
      failures: entry.failures,
      shortCircuited: false,
      retryAfterMs: 0,
    };
  }
}

export function getCircuitBreakerSnapshot(key: string): CircuitBreakerEntry {
  const entry = getOrCreateEntry(key);
  return {
    state: entry.state,
    failures: entry.failures,
    openedAt: entry.openedAt,
  };
}

export function __test__resetCircuitBreaker(): void {
  breakerStore.clear();
}
