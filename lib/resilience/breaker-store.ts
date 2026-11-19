import { randomUUID } from "crypto";
import type { Redis } from "@upstash/redis";
import { logger } from "@/lib/tracing/logger";
import type { BreakerState, CircuitBreakerConfig } from "./circuit-breaker";

/**
 * Shared state for lib/resilience/circuit-breaker.ts. The Redis store is the
 * production store; the memory store implements the same algorithm for one
 * instance and is what the Redis store degrades to.
 *
 * Per breaker: a state record (state, open_until, probe_until, probe_id) and
 * two time-ordered sets of recent outcomes (failures, all calls) trimmed to
 * the window. A half-open probe is a lease: exactly one caller holds it until
 * it reports or the lease (call timeout + margin) lapses.
 */

export interface AcquireResult {
  allowed: boolean;
  state: BreakerState;
  /** Set when this caller holds the half-open probe lease. */
  probeId: string | null;
  retryAfterMs: number;
}

export interface RecordResult {
  state: BreakerState;
  /** True when this report changed the state. */
  transitioned: boolean;
}

export interface BreakerStore {
  acquire(
    config: CircuitBreakerConfig,
    now: number,
    request: { probeId: string }
  ): Promise<AcquireResult>;
  record(
    config: CircuitBreakerConfig,
    now: number,
    report: { outcome: "success" | "failure"; probeId: string | null }
  ): Promise<RecordResult>;
  peek(config: CircuitBreakerConfig, now: number): Promise<BreakerState>;
}

/** Bounds memory under heavy traffic; the rate is computed over these. */
const MAX_SAMPLES = 1000;
const PROBE_LEASE_MARGIN_MS = 1_000;

function probeLeaseMs(config: CircuitBreakerConfig): number {
  return config.timeoutMs + PROBE_LEASE_MARGIN_MS;
}

/** Keys expire on their own so an idle breaker leaves nothing behind. */
function stateTtlMs(config: CircuitBreakerConfig): number {
  return Math.max(config.windowMs, config.cooldownMs) * 4;
}

function shouldOpen(
  config: CircuitBreakerConfig,
  failures: number,
  total: number
): boolean {
  return (
    failures >= config.failureThreshold &&
    total > 0 &&
    failures / total >= config.failureRate
  );
}

interface MemoryEntry {
  state: BreakerState;
  openUntil: number;
  probeUntil: number;
  probeId: string | null;
  failures: number[];
  totals: number[];
}

export function createMemoryBreakerStore(): BreakerStore & {
  reset(): void;
} {
  const entries = new Map<string, MemoryEntry>();

  function entry(name: string): MemoryEntry {
    let e = entries.get(name);
    if (!e) {
      e = {
        state: "closed",
        openUntil: 0,
        probeUntil: 0,
        probeId: null,
        failures: [],
        totals: [],
      };
      entries.set(name, e);
    }
    return e;
  }

  return {
    async acquire(config, now, { probeId }) {
      const e = entry(config.name);
      if (e.state === "closed") {
        return {
          allowed: true,
          state: "closed",
          probeId: null,
          retryAfterMs: 0,
        };
      }
      if (e.state === "open" && now < e.openUntil) {
        return {
          allowed: false,
          state: "open",
          probeId: null,
          retryAfterMs: e.openUntil - now,
        };
      }
      if (e.state === "half_open" && now < e.probeUntil) {
        return {
          allowed: false,
          state: "half_open",
          probeId: null,
          retryAfterMs: e.probeUntil - now,
        };
      }
      e.state = "half_open";
      e.probeUntil = now + probeLeaseMs(config);
      e.probeId = probeId;
      return { allowed: true, state: "half_open", probeId, retryAfterMs: 0 };
    },

    async record(config, now, { outcome, probeId }) {
      const e = entry(config.name);
      if (probeId) {
        if (e.state !== "half_open" || e.probeId !== probeId) {
          return { state: e.state, transitioned: false };
        }
        if (outcome === "success") {
          entries.delete(config.name);
          return { state: "closed", transitioned: true };
        }
        e.state = "open";
        e.openUntil = now + config.cooldownMs;
        e.probeUntil = 0;
        e.probeId = null;
        return { state: "open", transitioned: true };
      }
      if (e.state !== "closed") {
        // A call that started before the breaker opened; the state already
        // reflects the outage.
        return { state: e.state, transitioned: false };
      }
      const cutoff = now - config.windowMs;
      e.totals = e.totals.filter(t => t > cutoff);
      e.failures = e.failures.filter(t => t > cutoff);
      e.totals.push(now);
      if (outcome === "failure") {
        e.failures.push(now);
      }
      e.totals = e.totals.slice(-MAX_SAMPLES);
      e.failures = e.failures.slice(-MAX_SAMPLES);
      if (shouldOpen(config, e.failures.length, e.totals.length)) {
        e.state = "open";
        e.openUntil = now + config.cooldownMs;
        e.failures = [];
        e.totals = [];
        return { state: "open", transitioned: true };
      }
      return { state: "closed", transitioned: false };
    },

    async peek(config) {
      return entry(config.name).state;
    },

    reset() {
      entries.clear();
    },
  };
}

// KEYS[1] state hash. ARGV: now, probe lease ms, probe id, ttl ms.
// Returns {allowed, state, is_probe, retry_after_ms}.
export const ACQUIRE_SCRIPT = `
local now = tonumber(ARGV[1])
local state = redis.call("HGET", KEYS[1], "state") or "closed"
if state == "closed" then
  return {1, "closed", 0, 0}
end
if state == "open" then
  local open_until = tonumber(redis.call("HGET", KEYS[1], "open_until") or "0")
  if now < open_until then
    return {0, "open", 0, open_until - now}
  end
else
  local probe_until = tonumber(redis.call("HGET", KEYS[1], "probe_until") or "0")
  if now < probe_until then
    return {0, "half_open", 0, probe_until - now}
  end
end
redis.call("HSET", KEYS[1], "state", "half_open",
  "probe_until", now + tonumber(ARGV[2]), "probe_id", ARGV[3])
redis.call("PEXPIRE", KEYS[1], ARGV[4])
return {1, "half_open", 1, 0}
`;

// KEYS[1] state hash, KEYS[2] failure zset, KEYS[3] all-calls zset.
// ARGV: now, outcome, probe id ("" when not a probe), window ms, failure
// threshold, failure rate, cooldown ms, unique member, ttl ms, max samples.
// Returns {state, transitioned}.
export const RECORD_SCRIPT = `
local now = tonumber(ARGV[1])
local outcome = ARGV[2]
local probe_id = ARGV[3]
local state = redis.call("HGET", KEYS[1], "state") or "closed"
if probe_id ~= "" then
  if state ~= "half_open" or redis.call("HGET", KEYS[1], "probe_id") ~= probe_id then
    return {state, 0}
  end
  if outcome == "success" then
    redis.call("DEL", KEYS[1], KEYS[2], KEYS[3])
    return {"closed", 1}
  end
  redis.call("HSET", KEYS[1], "state", "open", "open_until", now + tonumber(ARGV[7]))
  redis.call("HDEL", KEYS[1], "probe_until", "probe_id")
  redis.call("PEXPIRE", KEYS[1], ARGV[9])
  return {"open", 1}
end
if state ~= "closed" then
  return {state, 0}
end
local cutoff = now - tonumber(ARGV[4])
local max_samples = tonumber(ARGV[10])
redis.call("ZREMRANGEBYSCORE", KEYS[2], "-inf", cutoff)
redis.call("ZREMRANGEBYSCORE", KEYS[3], "-inf", cutoff)
redis.call("ZADD", KEYS[3], now, ARGV[8])
if outcome == "failure" then
  redis.call("ZADD", KEYS[2], now, ARGV[8])
end
redis.call("ZREMRANGEBYRANK", KEYS[2], 0, -(max_samples + 1))
redis.call("ZREMRANGEBYRANK", KEYS[3], 0, -(max_samples + 1))
redis.call("PEXPIRE", KEYS[2], ARGV[4])
redis.call("PEXPIRE", KEYS[3], ARGV[4])
local failures = redis.call("ZCARD", KEYS[2])
local total = redis.call("ZCARD", KEYS[3])
if failures >= tonumber(ARGV[5]) and total > 0 and failures / total >= tonumber(ARGV[6]) then
  redis.call("HSET", KEYS[1], "state", "open", "open_until", now + tonumber(ARGV[7]))
  redis.call("PEXPIRE", KEYS[1], ARGV[9])
  redis.call("DEL", KEYS[2], KEYS[3])
  return {"open", 1}
end
return {"closed", 0}
`;

function keys(name: string): [string, string, string] {
  const base = `cb:{${name}}`;
  return [`${base}:state`, `${base}:failures`, `${base}:calls`];
}

/** Redis must answer faster than this or the call proceeds on the fallback. */
const REDIS_TIMEOUT_MS = 750;
const DEGRADED_LOG_INTERVAL_MS = 60_000;

function withRedisTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("breaker store timed out")),
        REDIS_TIMEOUT_MS
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

function asState(value: unknown): BreakerState {
  return value === "open" || value === "half_open" ? value : "closed";
}

export function createRedisBreakerStore(
  redis: Pick<Redis, "eval" | "hget">,
  fallback: BreakerStore
): BreakerStore {
  let lastDegradedLog = 0;

  function degraded(op: string, error: unknown): void {
    const now = Date.now();
    if (now - lastDegradedLog >= DEGRADED_LOG_INTERVAL_MS) {
      lastDegradedLog = now;
      logger.warn("circuit_breaker_store_degraded", {
        op,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    async acquire(config, now, request) {
      const [stateKey] = keys(config.name);
      try {
        const [allowed, state, isProbe, retryAfter] = (await withRedisTimeout(
          redis.eval(
            ACQUIRE_SCRIPT,
            [stateKey],
            [
              String(now),
              String(probeLeaseMs(config)),
              request.probeId,
              String(stateTtlMs(config)),
            ]
          )
        )) as [number, string, number, number];
        return {
          allowed: allowed === 1,
          state: asState(state),
          probeId: isProbe === 1 ? request.probeId : null,
          retryAfterMs: Number(retryAfter) || 0,
        };
      } catch (error) {
        degraded("acquire", error);
        return fallback.acquire(config, now, request);
      }
    },

    async record(config, now, report) {
      try {
        const [state, transitioned] = (await withRedisTimeout(
          redis.eval(RECORD_SCRIPT, keys(config.name), [
            String(now),
            report.outcome,
            report.probeId ?? "",
            String(config.windowMs),
            String(config.failureThreshold),
            String(config.failureRate),
            String(config.cooldownMs),
            `${now}:${randomUUID()}`,
            String(stateTtlMs(config)),
            String(MAX_SAMPLES),
          ])
        )) as [string, number];
        return { state: asState(state), transitioned: transitioned === 1 };
      } catch (error) {
        degraded("record", error);
        return fallback.record(config, now, report);
      }
    },

    async peek(config, now) {
      try {
        const [stateKey] = keys(config.name);
        return asState(
          await withRedisTimeout(redis.hget<string>(stateKey, "state"))
        );
      } catch (error) {
        degraded("peek", error);
        return fallback.peek(config, now);
      }
    },
  };
}
