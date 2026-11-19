import { randomUUID } from "crypto";
import { getUpstashRedis } from "@/lib/upstash-redis";
import { logger } from "@/lib/tracing/logger";
import {
  createMemoryBreakerStore,
  createRedisBreakerStore,
  type BreakerStore,
} from "./breaker-store";

/**
 * Circuit breaker for downstream dependencies (#1418). One implementation,
 * one independently configured and independently stored instance per
 * dependency (see lib/resilience/breakers.ts).
 *
 *   closed ──(failures ≥ threshold and failure rate ≥ rate, within window)──▶ open
 *   open ──(cooldown elapsed; exactly one caller takes the probe lease)──▶ half_open
 *   half_open ──probe succeeds──▶ closed
 *   half_open ──probe fails──▶ open (new cooldown)
 *
 * State lives in Upstash Redis so every serverless instance sees the same
 * breaker. Transitions run as Lua scripts, so they are atomic: concurrent
 * callers cannot all become half-open probes. Without Redis, or when Redis
 * errors or is slow, the breaker degrades to a per-instance breaker instead
 * of blocking calls (same policy as lib/rate-limit.ts).
 *
 * Every call also gets a hard timeout: a breaker that waits forever for the
 * first failure protects nothing.
 */

export type BreakerState = "closed" | "open" | "half_open";

export interface CircuitBreakerConfig {
  /** Namespaces the shared state; one per dependency. */
  name: string;
  /** Minimum failures inside the window before the breaker can open. */
  failureThreshold: number;
  /** Failures / all calls inside the window at or above which it opens. */
  failureRate: number;
  /** Rolling window over which failures are counted, ms. */
  windowMs: number;
  /** Time spent open before one probe call is let through, ms. */
  cooldownMs: number;
  /** Hard limit for one call, ms. */
  timeoutMs: number;
}

export type FailureKind =
  | "timeout"
  | "network"
  | "rate_limited"
  | "server_error"
  | "client_error";

/** Thrown without calling the dependency while the breaker is open. */
export class CircuitOpenError extends Error {
  readonly breaker: string;
  readonly retryAfterMs: number;
  constructor(breaker: string, retryAfterMs: number) {
    super(`${breaker} is unavailable (circuit open)`);
    this.name = "CircuitOpenError";
    this.breaker = breaker;
    this.retryAfterMs = retryAfterMs;
  }
}

export class DownstreamTimeoutError extends Error {
  readonly breaker: string;
  constructor(breaker: string, timeoutMs: number) {
    super(`${breaker} did not respond within ${timeoutMs}ms`);
    this.name = "DownstreamTimeoutError";
    this.breaker = breaker;
  }
}

export function httpStatusOf(error: unknown): number | undefined {
  const e = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };
  for (const candidate of [e?.response?.status, e?.status, e?.statusCode]) {
    if (typeof candidate === "number") {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Which failures say something about the dependency's health. A 4xx other
 * than 408/429 is the dependency answering correctly about a bad or missing
 * resource (an unfunded Stellar account is a 404), so it counts as a healthy
 * response and never trips the breaker.
 */
export function classifyFailure(error: unknown): FailureKind {
  if (error instanceof DownstreamTimeoutError) {
    return "timeout";
  }
  const status = httpStatusOf(error);
  if (status === undefined) {
    const name = (error as { name?: string; code?: string })?.name ?? "";
    const code = (error as { code?: string })?.code ?? "";
    if (
      /timeout/i.test(name) ||
      code === "ECONNABORTED" ||
      code === "ETIMEDOUT"
    ) {
      return "timeout";
    }
    return "network";
  }
  if (status === 429) {
    return "rate_limited";
  }
  if (status === 408 || status >= 500) {
    return status === 408 ? "timeout" : "server_error";
  }
  return "client_error";
}

export function countsAsFailure(kind: FailureKind): boolean {
  return kind !== "client_error";
}

export function validateBreakerConfig(config: CircuitBreakerConfig): void {
  const positive: (keyof CircuitBreakerConfig)[] = [
    "failureThreshold",
    "windowMs",
    "cooldownMs",
    "timeoutMs",
  ];
  for (const key of positive) {
    const value = config[key] as number;
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(
        `circuit breaker "${config.name}": ${key} must be a positive number`
      );
    }
  }
  if (
    !Number.isFinite(config.failureRate) ||
    config.failureRate <= 0 ||
    config.failureRate > 1
  ) {
    throw new Error(
      `circuit breaker "${config.name}": failureRate must be in (0, 1]`
    );
  }
  if (!/^[a-z0-9_-]+$/.test(config.name)) {
    throw new Error(`circuit breaker name "${config.name}" is invalid`);
  }
}

export interface CircuitBreakerDeps {
  store?: BreakerStore;
  now?: () => number;
}

export interface ExecuteOptions {
  /** Overrides the default failure classification for this call. */
  classify?: (error: unknown) => FailureKind;
  /** Overrides the breaker's timeout for a call known to be slow. */
  timeoutMs?: number;
}

export class CircuitBreaker {
  readonly config: Readonly<CircuitBreakerConfig>;
  private readonly store: BreakerStore;
  private readonly now: () => number;

  constructor(config: CircuitBreakerConfig, deps: CircuitBreakerDeps = {}) {
    validateBreakerConfig(config);
    this.config = Object.freeze({ ...config });
    this.now = deps.now ?? Date.now;
    this.store = deps.store ?? defaultStore();
  }

  /**
   * Runs `fn` through the breaker. `fn` receives an AbortSignal that fires at
   * the timeout; pass it to the HTTP client so the request is actually
   * cancelled rather than left running in the background.
   */
  async execute<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    options: ExecuteOptions = {}
  ): Promise<T> {
    const { name } = this.config;
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const permit = await this.store.acquire(this.config, this.now(), {
      probeId: randomUUID(),
    });
    if (!permit.allowed) {
      logger.warn("circuit_breaker_rejected", {
        breaker: name,
        state: permit.state,
        retry_after_ms: permit.retryAfterMs,
      });
      throw new CircuitOpenError(name, permit.retryAfterMs);
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new DownstreamTimeoutError(name, timeoutMs));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([fn(controller.signal), timeout]);
      await this.record("success", permit.probeId);
      return result;
    } catch (error) {
      const kind = (options.classify ?? classifyFailure)(error);
      await this.record(
        countsAsFailure(kind) ? "failure" : "success",
        permit.probeId,
        kind
      );
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async state(): Promise<BreakerState> {
    return this.store.peek(this.config, this.now());
  }

  private async record(
    outcome: "success" | "failure",
    probeId: string | null,
    kind?: FailureKind
  ): Promise<void> {
    const { state, transitioned } = await this.store.record(
      this.config,
      this.now(),
      { outcome, probeId }
    );
    if (transitioned) {
      const data = {
        breaker: this.config.name,
        from: probeId ? "half_open" : "closed",
        to: state,
        failure_kind: kind ?? null,
      };
      if (state === "open") {
        logger.error("circuit_breaker_transition", data);
      } else {
        logger.info("circuit_breaker_transition", data);
      }
    }
  }
}

let sharedStore: BreakerStore | undefined;

function defaultStore(): BreakerStore {
  if (!sharedStore) {
    const redis = getUpstashRedis();
    sharedStore = redis
      ? createRedisBreakerStore(redis, createMemoryBreakerStore())
      : createMemoryBreakerStore();
  }
  return sharedStore;
}

export function resetBreakerStoreForTests(): void {
  sharedStore = undefined;
}
