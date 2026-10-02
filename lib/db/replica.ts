import {
  sql as primarySql,
  createPool,
  type QueryResult,
  type QueryResultRow,
  type VercelPool,
} from "@vercel/postgres";
import { NextResponse } from "next/server";
import { logger } from "@/lib/tracing/logger";
import { signToken, verifyToken } from "@/lib/auth/sign-token";

/**
 * Read-replica routing for analytics and reporting reads.
 * See docs/database/read-replicas.md for the routing rules and operations.
 *
 * Only code that calls readFromReplica() can reach the replica; every other
 * query keeps using `sql` from @vercel/postgres, which is the primary. Writes,
 * transactions and reads that must see the latest write stay on `sql`.
 *
 * Routing for a readFromReplica() call:
 *   1. POSTGRES_REPLICA_URL unset          → primary ("unconfigured")
 *   2. caller wrote in the last N seconds  → primary ("recent-write")
 *   3. circuit breaker open                → bounded fallback ("breaker-open")
 *   4. replica lag above threshold         → bounded fallback ("lag")
 *   5. otherwise                           → replica; on a connection-level
 *                                            failure → bounded fallback
 *
 * "Bounded fallback" runs the read on the primary only while fewer than
 * DB_REPLICA_FALLBACK_CONCURRENCY fallback reads are in flight on this
 * instance. Past that it throws ReplicaUnavailableError (HTTP 503), so a
 * replica outage cannot shift the full analytics load onto the primary.
 */

type Primitive = string | number | boolean | undefined | null;

/**
 * What a readFromReplica callback receives: the same shape as the `sql`
 * export of @vercel/postgres (tagged template plus `.query(text, params)`
 * for queries built at runtime), bound to the chosen database.
 */
export type SqlTag = (<O extends QueryResultRow = QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: Primitive[]
) => Promise<QueryResult<O>>) & {
  query: <O extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<QueryResult<O>>;
};

export type DbTarget = "primary" | "replica";

export type RouteReason =
  | "unconfigured"
  | "recent-write"
  | "breaker-open"
  | "lag"
  | "replica-error"
  | "healthy";

export const RECENT_WRITE_COOKIE = "sf_recent_write";

export interface ReplicaConfig {
  url: string | undefined;
  maxLagSeconds: number;
  fallbackConcurrency: number;
  breakerThreshold: number;
  breakerCooldownMs: number;
  lagProbeTtlMs: number;
  queryTimeoutMs: number;
  readYourWritesSeconds: number;
  slowQueryMs: number;
}

function intFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function loadReplicaConfig(
  env: NodeJS.ProcessEnv = process.env
): ReplicaConfig {
  const maxLagSeconds = intFromEnv(env.DB_REPLICA_MAX_LAG_SECONDS, 30);
  return {
    url: env.POSTGRES_REPLICA_URL?.trim() || undefined,
    maxLagSeconds,
    fallbackConcurrency: intFromEnv(env.DB_REPLICA_FALLBACK_CONCURRENCY, 4),
    breakerThreshold: Math.max(
      1,
      intFromEnv(env.DB_REPLICA_BREAKER_THRESHOLD, 3)
    ),
    breakerCooldownMs: intFromEnv(env.DB_REPLICA_BREAKER_COOLDOWN_MS, 30_000),
    lagProbeTtlMs: intFromEnv(env.DB_REPLICA_LAG_PROBE_TTL_MS, 5_000),
    queryTimeoutMs: intFromEnv(env.DB_REPLICA_QUERY_TIMEOUT_MS, 5_000),
    // A user's own write must be visible even at the worst tolerated lag.
    readYourWritesSeconds: intFromEnv(
      env.DB_READ_YOUR_WRITES_SECONDS,
      maxLagSeconds
    ),
    slowQueryMs: intFromEnv(env.DB_SLOW_QUERY_MS, 500),
  };
}

export class ReplicaUnavailableError extends Error {
  constructor(readonly reason: RouteReason) {
    super(`Read replica unavailable (${reason}) and fallback capacity is full`);
    this.name = "ReplicaUnavailableError";
  }
}

class ReplicaTimeoutError extends Error {
  constructor(ms: number) {
    super(`Replica query timed out after ${ms}ms`);
    this.name = "ReplicaTimeoutError";
  }
}

// ── Per-instance state ───────────────────────────────────────────────────────
// Serverless instances each keep their own breaker, lag cache and fallback
// counter. That is deliberate: no shared store sits on the read path, and each
// instance's fallback cap bounds its own contribution to primary load.

interface RouterState {
  config: ReplicaConfig;
  pool: VercelPool | null;
  consecutiveFailures: number;
  breakerOpenUntil: number;
  lag: { seconds: number | null; checkedAt: number } | null;
  lagProbe: Promise<number | null> | null;
  fallbackInFlight: number;
}

let state: RouterState | null = null;

/**
 * @vercel/postgres pools only accept pooled (`-pooler.`) or localhost URLs.
 * A direct URL would fail on every query and read as a replica outage, so it
 * is rejected once, loudly, and the router stays on the primary.
 */
function usableReplicaUrl(config: ReplicaConfig): ReplicaConfig {
  const url = config.url;
  if (
    !url ||
    url.includes("-pooler.") ||
    /@(localhost|127\.0\.0\.1)[:/]/.test(url)
  ) {
    return config;
  }
  logger.error("db.replica.misconfigured", {
    errorMessage:
      "POSTGRES_REPLICA_URL must be the replica's pooled connection string (host contains -pooler.); replica routing disabled",
  });
  return { ...config, url: undefined };
}

function getState(): RouterState {
  if (!state) {
    state = {
      config: usableReplicaUrl(loadReplicaConfig()),
      pool: null,
      consecutiveFailures: 0,
      breakerOpenUntil: 0,
      lag: null,
      lagProbe: null,
      fallbackInFlight: 0,
    };
  }
  return state;
}

/** Test hook: drops all per-instance state and re-reads the environment. */
export function resetReplicaRouter(): void {
  state = null;
}

function primaryTag(): SqlTag {
  return primarySql as unknown as SqlTag;
}

function replicaTag(s: RouterState): SqlTag {
  if (!s.pool) {
    s.pool = createPool({ connectionString: s.config.url });
  }
  const pool = s.pool;
  const tag = (strings: TemplateStringsArray, ...values: Primitive[]) =>
    pool.sql(strings, ...values);
  return Object.assign(tag, {
    query: (text: string, params?: unknown[]) => pool.query(text, params),
  }) as SqlTag;
}

// ── Read-your-own-writes marker ──────────────────────────────────────────────

interface RecentWriteToken {
  /** Epoch ms of the write. */
  w: number;
}

/**
 * The marker is HMAC-signed with SESSION_SECRET. A client that could set it
 * freely could pin every one of its reads to the primary, bypassing the
 * fallback cap during a replica incident. Without the secret the marker is
 * neither issued nor honoured.
 */
function markerSecret(): string | null {
  return process.env.SESSION_SECRET || null;
}

/**
 * Marks the caller as having just written. For the next
 * DB_READ_YOUR_WRITES_SECONDS their replica-routed reads go to the primary,
 * so they never see a replica that has not caught up with their own write.
 * Call it on the response of any write whose result feeds a replica-routed
 * read for the same user.
 */
export function markRecentWrite<T extends NextResponse>(
  response: T,
  now: number = Date.now()
): T {
  const window = getState().config.readYourWritesSeconds;
  const secret = markerSecret();
  if (window > 0 && secret) {
    response.cookies.set(
      RECENT_WRITE_COOKIE,
      signToken({ w: now } satisfies RecentWriteToken, secret),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: window,
      }
    );
  }
  return response;
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return rest.join("=");
    }
  }
  return undefined;
}

export function hasRecentWrite(
  request: Request | undefined,
  now: number = Date.now()
): boolean {
  const secret = markerSecret();
  if (!request || !secret) {
    return false;
  }
  const raw = readCookie(request, RECENT_WRITE_COOKIE);
  if (!raw) {
    return false;
  }
  const token = verifyToken<RecentWriteToken>(raw, secret);
  if (!token || typeof token.w !== "number") {
    return false;
  }
  const windowMs = getState().config.readYourWritesSeconds * 1000;
  // The cookie expires with the window, but a replayed copy would not.
  return token.w <= now && now - token.w < windowMs;
}

// ── Failure classification ───────────────────────────────────────────────────

const REPLICA_SQLSTATES = new Set([
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
  "53300", // too_many_connections
]);

/**
 * True for failures of the replica itself (connection, shutdown, overload,
 * recovery conflicts), where retrying on the primary is correct. False for
 * query bugs, which would fail the same way on the primary, and for
 * 25006 read_only_sql_transaction: a write reached the replica path, and
 * retrying it on the primary would hide the misrouting.
 */
export function isReplicaInfraError(error: unknown): boolean {
  if (error instanceof ReplicaTimeoutError) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as Error & { code?: unknown }).code;
  if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
    if (code.startsWith("08") || REPLICA_SQLSTATES.has(code)) {
      return true;
    }
    return (
      (code === "40001" || code === "40P01") &&
      /conflict with recovery/i.test(error.message)
    );
  }
  if (typeof code === "string" && /^E[A-Z]+$/.test(code)) {
    return true; // Node errno, e.g. ECONNREFUSED, ETIMEDOUT
  }
  return /connect|terminat|timed? ?out|socket|network|fetch failed/i.test(
    error.message
  );
}

// ── Health: breaker + lag ────────────────────────────────────────────────────

function breakerOpen(s: RouterState, now: number): boolean {
  return s.breakerOpenUntil > now;
}

function recordReplicaFailure(s: RouterState, now: number, label: string) {
  s.consecutiveFailures += 1;
  if (s.consecutiveFailures >= s.config.breakerThreshold) {
    const wasOpen = breakerOpen(s, now);
    s.breakerOpenUntil = now + s.config.breakerCooldownMs;
    if (!wasOpen) {
      logger.warn("db.replica.breaker_open", {
        label,
        consecutiveFailures: s.consecutiveFailures,
        cooldownMs: s.config.breakerCooldownMs,
      });
    }
  }
}

function recordReplicaSuccess(s: RouterState) {
  s.consecutiveFailures = 0;
  s.breakerOpenUntil = 0;
}

/**
 * Seconds the replica is behind. 0 when it is streaming WAL, has heard from
 * the primary within the lag threshold, and has replayed everything it
 * received (an idle primary would otherwise look like growing lag; a healthy
 * idle stream still exchanges status messages every ~10s). If the stream is
 * stalled or disconnected, "replayed everything received" proves nothing, so
 * the replay timestamp decides. null when the replica cannot report lag,
 * which counts as unhealthy.
 */
async function probeLag(s: RouterState): Promise<number | null> {
  const tag = replicaTag(s);
  const { rows } = await withTimeout(
    tag<{ lag_seconds: string | number | null }>`
      SELECT CASE
        WHEN NOT pg_is_in_recovery() THEN 0
        WHEN pg_last_wal_receive_lsn() IS NOT NULL
          AND pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn()
          AND EXISTS (
            SELECT 1 FROM pg_stat_wal_receiver
            WHERE status = 'streaming'
              AND last_msg_receipt_time > now() - make_interval(secs => ${s.config.maxLagSeconds})
          )
          THEN 0
        ELSE EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp())
      END AS lag_seconds
    `,
    s.config.queryTimeoutMs
  );
  const raw = rows[0]?.lag_seconds;
  return raw === null || raw === undefined ? null : Number(raw);
}

async function lagWithinThreshold(
  s: RouterState,
  now: number,
  label: string
): Promise<boolean> {
  const cached = s.lag;
  if (!cached || now - cached.checkedAt >= s.config.lagProbeTtlMs) {
    if (!s.lagProbe) {
      s.lagProbe = probeLag(s).finally(() => {
        s.lagProbe = null;
      });
    }
    try {
      const seconds = await s.lagProbe;
      s.lag = { seconds, checkedAt: now };
    } catch (error) {
      if (!isReplicaInfraError(error)) {
        throw error;
      }
      recordReplicaFailure(s, now, `${label}:lag-probe`);
      s.lag = { seconds: null, checkedAt: now };
    }
  }

  const seconds = s.lag?.seconds ?? null;
  const ok = seconds !== null && seconds <= s.config.maxLagSeconds;
  if (!ok) {
    logger.warn("db.replica.lag_exceeded", {
      label,
      lagSeconds: seconds,
      maxLagSeconds: s.config.maxLagSeconds,
    });
  }
  return ok;
}

// ── Execution ────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) {
    return promise;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ReplicaTimeoutError(ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function execute<T>(
  s: RouterState,
  label: string,
  target: DbTarget,
  reason: RouteReason,
  run: (sql: SqlTag) => Promise<T>
): Promise<T> {
  const started = performance.now();
  const promise =
    target === "replica"
      ? withTimeout(run(replicaTag(s)), s.config.queryTimeoutMs)
      : run(primaryTag());
  try {
    return await promise;
  } finally {
    const durationMs = Math.round(performance.now() - started);
    const event = { label, target, reason, durationMs };
    if (durationMs >= s.config.slowQueryMs) {
      logger.warn("db.slow_query", event);
    } else {
      logger.debug("db.read", event);
    }
  }
}

async function boundedFallback<T>(
  s: RouterState,
  label: string,
  reason: RouteReason,
  run: (sql: SqlTag) => Promise<T>
): Promise<T> {
  if (s.fallbackInFlight >= s.config.fallbackConcurrency) {
    logger.warn("db.replica.fallback_rejected", {
      label,
      reason,
      inFlight: s.fallbackInFlight,
      cap: s.config.fallbackConcurrency,
    });
    throw new ReplicaUnavailableError(reason);
  }
  s.fallbackInFlight += 1;
  logger.warn("db.replica.fallback", { label, reason });
  try {
    return await execute(s, label, "primary", reason, run);
  } finally {
    s.fallbackInFlight -= 1;
  }
}

export interface ReplicaReadOptions {
  /** The incoming request; used for the read-your-own-writes marker. */
  request?: Request;
}

/**
 * Runs a read-only query on the read replica when one is configured and
 * healthy. `run` receives the tag to use and must only issue reads: the
 * replica rejects writes (SQLSTATE 25006) and they are not retried.
 *
 * `label` names the query in logs, e.g. "admin.analytics.counts".
 */
export async function readFromReplica<T>(
  label: string,
  run: (sql: SqlTag) => Promise<T>,
  options: ReplicaReadOptions = {}
): Promise<T> {
  const s = getState();
  const now = Date.now();

  if (!s.config.url) {
    return execute(s, label, "primary", "unconfigured", run);
  }
  if (hasRecentWrite(options.request, now)) {
    return execute(s, label, "primary", "recent-write", run);
  }
  if (breakerOpen(s, now)) {
    return boundedFallback(s, label, "breaker-open", run);
  }
  if (!(await lagWithinThreshold(s, now, label))) {
    return boundedFallback(s, label, "lag", run);
  }

  try {
    const result = await execute(s, label, "replica", "healthy", run);
    recordReplicaSuccess(s);
    return result;
  } catch (error) {
    if (!isReplicaInfraError(error)) {
      throw error;
    }
    recordReplicaFailure(s, Date.now(), label);
    logger.warn("db.replica.error", {
      label,
      errorName: error instanceof Error ? error.name : "unknown",
      errorCode: (error as { code?: unknown }).code ?? null,
    });
    return boundedFallback(s, label, "replica-error", run);
  }
}

/** 503 for routes whose replica read could not be served. */
export function replicaUnavailableResponse(): NextResponse {
  return NextResponse.json(
    { error: "Analytics temporarily unavailable, please retry shortly" },
    { status: 503, headers: { "Retry-After": "30" } }
  );
}
