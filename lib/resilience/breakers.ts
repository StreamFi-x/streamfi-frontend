import { logger } from "@/lib/tracing/logger";
import {
  CircuitBreaker,
  validateBreakerConfig,
  type CircuitBreakerConfig,
} from "./circuit-breaker";

/**
 * The breaker instances, one per downstream dependency. Each has its own
 * Redis state (keyed by name), thresholds, cooldown and timeout, so Horizon
 * degrading never makes Mux unavailable and vice versa.
 *
 * Defaults (override per environment, e.g. CB_HORIZON_TIMEOUT_MS):
 * - timeoutMs: Horizon 8s. A 200-record payments page normally returns in
 *   well under a second, and 8s leaves room for a slow page while still
 *   freeing the function long before its 60s limit. Mux 10s matches the read
 *   timeout the Mux reconciliation already uses (lib/mux/server.ts).
 * - failureThreshold 5 and failureRate 0.5 over 60s: one or two blips never
 *   open the breaker; a dependency failing most calls for a minute does.
 * - cooldownMs 30s: long enough to stop hammering a struggling service, short
 *   enough that recovery is noticed quickly (then one probe decides).
 */

type Tunable = Exclude<keyof CircuitBreakerConfig, "name">;

const ENV_SUFFIX: Record<Tunable, string> = {
  failureThreshold: "FAILURE_THRESHOLD",
  failureRate: "FAILURE_RATE",
  windowMs: "WINDOW_MS",
  cooldownMs: "COOLDOWN_MS",
  timeoutMs: "TIMEOUT_MS",
};

export const HORIZON_BREAKER_DEFAULTS: CircuitBreakerConfig = {
  name: "horizon",
  failureThreshold: 5,
  failureRate: 0.5,
  windowMs: 60_000,
  cooldownMs: 30_000,
  timeoutMs: 8_000,
};

export const MUX_BREAKER_DEFAULTS: CircuitBreakerConfig = {
  name: "mux",
  failureThreshold: 5,
  failureRate: 0.5,
  windowMs: 60_000,
  cooldownMs: 30_000,
  timeoutMs: 10_000,
};

/**
 * Applies CB_<NAME>_<SETTING> overrides. An override that is not a valid
 * value is ignored with a warning, keeping the default: a typo must never
 * silently switch protection off.
 */
export function breakerConfigFromEnv(
  defaults: CircuitBreakerConfig,
  env: Record<string, string | undefined> = process.env
): CircuitBreakerConfig {
  const config = { ...defaults };
  for (const key of Object.keys(ENV_SUFFIX) as Tunable[]) {
    const envName = `CB_${defaults.name.toUpperCase()}_${ENV_SUFFIX[key]}`;
    const raw = env[envName];
    if (raw === undefined || raw.trim() === "") {
      continue;
    }
    const candidate = { ...config, [key]: Number(raw) };
    try {
      validateBreakerConfig(candidate);
      config[key] = candidate[key];
    } catch (error) {
      logger.warn("circuit_breaker_config_ignored", {
        breaker: defaults.name,
        env: envName,
        value: raw,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return config;
}

let horizon: CircuitBreaker | undefined;
let mux: CircuitBreaker | undefined;

export function getHorizonBreaker(): CircuitBreaker {
  horizon ??= new CircuitBreaker(
    breakerConfigFromEnv(HORIZON_BREAKER_DEFAULTS)
  );
  return horizon;
}

export function getMuxBreaker(): CircuitBreaker {
  mux ??= new CircuitBreaker(breakerConfigFromEnv(MUX_BREAKER_DEFAULTS));
  return mux;
}

export function resetBreakersForTests(): void {
  horizon = undefined;
  mux = undefined;
}
