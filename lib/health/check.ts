import { timingSafeEqual } from "crypto";
import { sql } from "@vercel/postgres";
import { getUpstashRedis } from "@/lib/upstash-redis";
import { getHorizonBreaker, getMuxBreaker } from "@/lib/resilience/breakers";
import { horizonBaseUrl } from "@/lib/stellar/horizon-client";
import { logger } from "@/lib/tracing/logger";

export type DependencyStatus = "up" | "down" | "degraded" | "unconfigured";

export interface DependencyCheckResult {
  status: DependencyStatus;
  connected: boolean;
  latencyMs: number;
  circuitState?: "closed" | "open" | "half_open";
  error?: string;
}

export interface SystemHealthReport {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  timestamp: string;
  dependencies: {
    database: DependencyCheckResult;
    redis: DependencyCheckResult;
    mux: DependencyCheckResult;
    stellarHorizon: DependencyCheckResult;
  };
  services: {
    db: DependencyCheckResult;
    cache: DependencyCheckResult;
    mux: DependencyCheckResult;
    stellar: DependencyCheckResult;
  };
  db: boolean;
  cache: boolean;
  mux: boolean;
  stellar: boolean;
}

export interface HealthCheckDeps {
  checkDatabase?: () => Promise<void>;
  checkRedis?: () => Promise<"up" | "unconfigured">;
  checkMux?: () => Promise<void>;
  checkStellarHorizon?: () => Promise<void>;
  timeoutMs?: number;
}

const DEFAULT_CHECK_TIMEOUT_MS = 4_000;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(`${label} health check timed out after ${timeoutMs}ms`)
        ),
      timeoutMs
    );
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  });
}

async function defaultDatabaseCheck(): Promise<void> {
  await sql`SELECT 1`;
}

async function defaultRedisCheck(): Promise<"up" | "unconfigured"> {
  const redis = getUpstashRedis();
  if (!redis) {
    return "unconfigured";
  }
  await redis.ping();
  return "up";
}

async function defaultMuxCheck(): Promise<void> {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    throw new Error("MUX_TOKEN_ID or MUX_TOKEN_SECRET is not configured");
  }

  const breaker = getMuxBreaker();
  const state = await breaker.state();
  if (state === "open") {
    throw new Error("Mux circuit breaker is open");
  }

  const auth = Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(
      "https://api.mux.com/video/v1/live-streams?limit=1",
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );
    if (!response.ok) {
      throw new Error(`Mux API responded with HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

async function defaultStellarHorizonCheck(): Promise<void> {
  const breaker = getHorizonBreaker();
  const state = await breaker.state();
  if (state === "open") {
    throw new Error("Stellar Horizon circuit breaker is open");
  }

  const baseUrl = horizonBaseUrl().replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/fee_stats`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Stellar Horizon responded with HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

async function runSingleCheck(
  name: string,
  fn: () => Promise<"up" | "unconfigured" | void>,
  timeoutMs: number,
  getCircuitState?: () => Promise<"closed" | "open" | "half_open">
): Promise<DependencyCheckResult> {
  const start = Date.now();
  let circuitState: "closed" | "open" | "half_open" | undefined;
  if (getCircuitState) {
    try {
      circuitState = await getCircuitState();
    } catch {
      circuitState = undefined;
    }
  }

  try {
    const outcome = await withTimeout(fn(), timeoutMs, name);
    const latencyMs = Date.now() - start;
    if (outcome === "unconfigured") {
      return {
        status: "unconfigured",
        connected: false,
        latencyMs,
        ...(circuitState ? { circuitState } : {}),
      };
    }
    const status: DependencyStatus =
      circuitState === "half_open" ? "degraded" : "up";
    return {
      status,
      connected: true,
      latencyMs,
      ...(circuitState ? { circuitState } : {}),
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.warn("Dependency health check failed", {
      dependency: name,
      latencyMs,
      circuitState,
      errorMessage,
    });
    return {
      status: "down",
      connected: false,
      latencyMs,
      ...(circuitState ? { circuitState } : {}),
      error: errorMessage,
    };
  }
}

/**
 * Checks connectivity to each major dependency (Postgres database, Redis,
 * Mux, and Stellar Horizon) independently in parallel and returns a structured
 * health report.
 */
export async function checkSystemHealth(
  deps: HealthCheckDeps = {}
): Promise<SystemHealthReport> {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS;
  const dbCheck = deps.checkDatabase ?? defaultDatabaseCheck;
  const redisCheck = deps.checkRedis ?? defaultRedisCheck;
  const muxCheck = deps.checkMux ?? defaultMuxCheck;
  const horizonCheck = deps.checkStellarHorizon ?? defaultStellarHorizonCheck;

  const [database, redis, mux, stellarHorizon] = await Promise.all([
    runSingleCheck("database", dbCheck, timeoutMs),
    runSingleCheck("redis", redisCheck, timeoutMs),
    runSingleCheck("mux", muxCheck, timeoutMs, () => getMuxBreaker().state()),
    runSingleCheck("stellarHorizon", horizonCheck, timeoutMs, () =>
      getHorizonBreaker().state()
    ),
  ]);

  const coreResults = [database, mux, stellarHorizon];
  const anyCoreDown = coreResults.some(r => r.status === "down");
  const redisDown = redis.status === "down";
  const anyDegraded = [database, redis, mux, stellarHorizon].some(
    r => r.status === "degraded"
  );

  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (
    database.status === "down" ||
    coreResults.every(r => r.status === "down")
  ) {
    overallStatus = "unhealthy";
  } else if (anyCoreDown || redisDown || anyDegraded) {
    overallStatus = "degraded";
  }

  return {
    status: overallStatus,
    version: process.env.npm_package_version || "0.1.0",
    timestamp: new Date().toISOString(),
    dependencies: {
      database,
      redis,
      mux,
      stellarHorizon,
    },
    services: {
      db: database,
      cache: redis,
      mux,
      stellar: stellarHorizon,
    },
    db: database.connected,
    cache: redis.connected,
    mux: mux.connected,
    stellar: stellarHorizon.connected,
  };
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Verifies whether a health check request is authorized when HEALTH_CHECK_SECRET
 * is configured. Supports `Authorization: Bearer <secret>` and `x-health-secret: <secret>`.
 * When HEALTH_CHECK_SECRET is not set, public health probing is allowed.
 */
export function verifyHealthCheckAuth(req: Request): {
  authorized: boolean;
  configured: boolean;
} {
  const secret = process.env.HEALTH_CHECK_SECRET?.trim();
  if (!secret) {
    return { authorized: true, configured: false };
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const headerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const customHeader = req.headers.get("x-health-secret")?.trim() ?? "";
  const candidate = headerToken || customHeader;

  if (!candidate) {
    return { authorized: false, configured: true };
  }

  return {
    authorized: constantTimeEquals(candidate, secret),
    configured: true,
  };
}
