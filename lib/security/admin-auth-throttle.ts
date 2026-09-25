import { createHash } from "crypto";
import { logger } from "@/lib/tracing/logger";
import { maskIp } from "@/lib/sessions/user-sessions";
import { getSecurityKvStore } from "@/lib/security/kv-store";
import { sendOperationalAlert } from "@/lib/security/alerts";

/**
 * Admin-specific brute-force protection (#1398).
 *
 * This is intentionally a separate, stricter path from lib/rate-limit.ts:
 * the general limiter counts requests in a fixed window, while this guard
 * counts *failed admin authentication attempts* and escalates. Every admin
 * authorization mechanism in the app funnels through `guardAdminAttempt`.
 *
 * Policy (see docs/admin-auth-throttling.md):
 *   - Failures are tracked per source IP and per presented credential
 *     (hashed), each remembered for 24h after the latest failure.
 *   - The first 3 failures are free; failure n >= 3 blocks that IP /
 *     credential for 30s * 2^(n-3), capped at 1h. There is no permanent
 *     lockout, so an attacker cannot lock an administrator out for good.
 *   - While blocked, requests are rejected with 429 *before* any
 *     authentication work is done. Attempts are counted before
 *     authenticating and the block is claimed atomically, so parallel
 *     bursts cannot race past it.
 *   - A global failure counter (10-minute buckets) catches distributed
 *     attempts that rotate IPs and credentials; it alerts but never blocks,
 *     because a global block would be a trivial DoS against real admins.
 *   - Alerts fire at 5 (warning) and 10 (critical) failures per IP or
 *     credential and at 20 global failures per 10 minutes, de-duplicated
 *     per level for an hour and capped by the alert module's hourly budget.
 *   - If the throttle store is unavailable the guard fails closed (503).
 */

export type AdminAuthMechanism =
  | "privy_session_allowlist"
  | "session_allowlist"
  | "session_role"
  | "static_admin_token"
  | "internal_secret";

export interface AdminAttempt {
  mechanism: AdminAuthMechanism;
  /** Route label for logs/alerts, e.g. "admin/users". */
  route: string;
  ip: string;
  /**
   * The credential material that was presented (cookie value, user id,
   * token). Only ever stored/logged as a truncated SHA-256 fingerprint.
   * null when the request carried no credential at all.
   */
  credential: string | null;
}

export type AdminGuardResult =
  | { ok: true }
  | { ok: false; reason: "denied" }
  | { ok: false; reason: "throttled"; retryAfterSeconds: number }
  | { ok: false; reason: "unavailable" };

export const ADMIN_AUTH_POLICY = {
  freeFailures: 3,
  baseBlockMs: 30_000,
  maxBlockMs: 60 * 60_000,
  failureMemoryMs: 24 * 60 * 60_000,
  warningAlertAt: 5,
  criticalAlertAt: 10,
  globalWindowMs: 10 * 60_000,
  globalAlertAt: 20,
  alertCooldownSeconds: 60 * 60,
} as const;

/** Block duration after the n-th consecutive failure (0 = not blocked). */
export function adminBlockDurationMs(failures: number): number {
  const { freeFailures, baseBlockMs, maxBlockMs } = ADMIN_AUTH_POLICY;
  if (failures < freeFailures) {
    return 0;
  }
  const exponent = Math.min(failures - freeFailures, 20);
  return Math.min(baseBlockMs * 2 ** exponent, maxBlockMs);
}

export function fingerprint(value: string): string {
  return createHash("sha256")
    .update(`streamfi-admin-auth:${value}`)
    .digest("hex")
    .slice(0, 32);
}

type Scope = "ip" | "cred";

function scopes(attempt: AdminAttempt): Array<{ scope: Scope; id: string }> {
  const out: Array<{ scope: Scope; id: string }> = [
    { scope: "ip", id: fingerprint(attempt.ip) },
  ];
  if (attempt.credential) {
    out.push({ scope: "cred", id: fingerprint(attempt.credential) });
  }
  return out;
}

const gateKey = (scope: Scope, id: string) => `adminauth:gate:${scope}:${id}`;
const failKey = (scope: Scope, id: string) => `adminauth:fail:${scope}:${id}`;

function logContext(attempt: AdminAttempt) {
  return {
    mechanism: attempt.mechanism,
    route: attempt.route,
    source_ip: maskIp(attempt.ip === "unknown" ? null : attempt.ip),
    credential_fp: attempt.credential
      ? fingerprint(attempt.credential).slice(0, 12)
      : null,
  };
}

async function alertIfNeeded(
  attempt: AdminAttempt,
  scope: Scope | "global",
  scopeId: string,
  failures: number
): Promise<void> {
  const { warningAlertAt, criticalAlertAt, globalAlertAt } = ADMIN_AUTH_POLICY;
  let severity: "warning" | "critical" | null = null;
  if (scope === "global") {
    severity = failures >= globalAlertAt ? "critical" : null;
  } else if (failures >= criticalAlertAt) {
    severity = "critical";
  } else if (failures >= warningAlertAt) {
    severity = "warning";
  }
  if (!severity) {
    return;
  }

  const title =
    scope === "global"
      ? "Elevated failed admin authentication attempts across all sources"
      : `Repeated failed admin authentication attempts (${scope === "ip" ? "single source IP" : "single credential"})`;

  await sendOperationalAlert({
    category: "admin_auth",
    event: "admin_auth_alerted",
    severity,
    title,
    dedupKey: `admin_auth:${scope}:${scopeId}:${severity}`,
    cooldownSeconds: ADMIN_AUTH_POLICY.alertCooldownSeconds,
    details: {
      ...logContext(attempt),
      scope,
      failed_attempts: failures,
      window:
        scope === "global"
          ? `${ADMIN_AUTH_POLICY.globalWindowMs / 60_000}m`
          : "24h sliding",
      escalation_block_seconds:
        scope === "global" ? 0 : adminBlockDurationMs(failures) / 1000,
    },
  });
}

type Admission =
  | { admitted: true; attempts: Array<{ scope: Scope; id: string; n: number }> }
  | { admitted: false; retryAfterMs: number };

/**
 * Decides whether this attempt may reach authentication.
 *
 * Attempts are counted *before* authenticating (pessimistically), and any
 * attempt that crosses into backoff must atomically claim a gate key whose TTL
 * is the block duration. This keeps a burst of parallel requests from all
 * slipping through before the first failure is recorded: only one request of
 * the burst claims the gate, the rest get 429.
 */
async function admit(attempt: AdminAttempt): Promise<Admission> {
  const store = getSecurityKvStore();
  const targets = scopes(attempt);

  const ttls = await Promise.all(
    targets.map(t => store.ttlMs(gateKey(t.scope, t.id)))
  );
  const blockedMs = Math.max(0, ...ttls);
  if (blockedMs > 0) {
    return { admitted: false, retryAfterMs: blockedMs };
  }

  const attempts: Array<{ scope: Scope; id: string; n: number }> = [];
  for (const t of targets) {
    const n = await store.incrWithTtl(
      failKey(t.scope, t.id),
      ADMIN_AUTH_POLICY.failureMemoryMs
    );
    attempts.push({ ...t, n });
    const blockMs = adminBlockDurationMs(n);
    if (blockMs > 0) {
      const claimed = await store.setIfAbsent(
        gateKey(t.scope, t.id),
        String(n),
        blockMs
      );
      if (!claimed) {
        const ttl = await store.ttlMs(gateKey(t.scope, t.id));
        return { admitted: false, retryAfterMs: Math.max(ttl, 1000) };
      }
    }
  }
  return { admitted: true, attempts };
}

async function recordFailure(
  attempt: AdminAttempt,
  attempts: Array<{ scope: Scope; id: string; n: number }>
): Promise<void> {
  const store = getSecurityKvStore();
  for (const { scope, id, n } of attempts) {
    logger.warn("admin_auth_failed", {
      ...logContext(attempt),
      scope,
      failed_attempts: n,
      block_seconds: adminBlockDurationMs(n) / 1000,
    });
    await alertIfNeeded(attempt, scope, id, n);
  }

  const { globalWindowMs } = ADMIN_AUTH_POLICY;
  const bucket = Math.floor(Date.now() / globalWindowMs);
  const globalFailures = await store.incrWithTtl(
    `adminauth:fail:global:${bucket}`,
    globalWindowMs
  );
  await alertIfNeeded(attempt, "global", String(bucket), globalFailures);
}

async function recordSuccess(attempt: AdminAttempt): Promise<void> {
  const store = getSecurityKvStore();
  const keys = scopes(attempt).flatMap(s => [
    failKey(s.scope, s.id),
    gateKey(s.scope, s.id),
  ]);
  await store.del(...keys);
}

/**
 * Runs `authenticate` behind the admin brute-force guard.
 * `authenticate` is not invoked at all while the caller is blocked.
 */
export async function guardAdminAttempt(
  attempt: AdminAttempt,
  authenticate: () => Promise<boolean>
): Promise<AdminGuardResult> {
  let admission: Admission;
  try {
    admission = await admit(attempt);
  } catch (err) {
    return failClosed(attempt, err);
  }
  if (!admission.admitted) {
    const retryAfterSeconds = Math.ceil(admission.retryAfterMs / 1000);
    logger.warn("admin_auth_throttled", {
      ...logContext(attempt),
      retry_after_seconds: retryAfterSeconds,
    });
    return { ok: false, reason: "throttled", retryAfterSeconds };
  }

  const ok = await authenticate();

  try {
    if (ok) {
      await recordSuccess(attempt);
      return { ok: true };
    }
    await recordFailure(attempt, admission.attempts);
  } catch (err) {
    return failClosed(attempt, err);
  }
  return { ok: false, reason: "denied" };
}

async function failClosed(
  attempt: AdminAttempt,
  err: unknown
): Promise<AdminGuardResult> {
  const message = err instanceof Error ? err.message : String(err);
  logger.error("admin_auth_guard_unavailable", {
    ...logContext(attempt),
    errorMessage: message,
  });
  await sendOperationalAlert({
    category: "admin_auth",
    event: "admin_auth_guard_unavailable",
    severity: "critical",
    title:
      "Admin auth throttle store unavailable — admin access failing closed",
    dedupKey: "admin_auth:guard_unavailable",
    cooldownSeconds: 15 * 60,
    details: { ...logContext(attempt), error: message },
  });
  return { ok: false, reason: "unavailable" };
}

/** Maps a failed guard result to an HTTP response. */
export function adminGuardResponse(
  result: Exclude<AdminGuardResult, { ok: true }>,
  denied: { status: 401 | 403; error: string } = {
    status: 401,
    error: "Unauthorized",
  }
): Response {
  if (result.reason === "throttled") {
    return Response.json(
      { error: "Too many failed admin authentication attempts" },
      {
        status: 429,
        headers: { "Retry-After": String(result.retryAfterSeconds) },
      }
    );
  }
  if (result.reason === "unavailable") {
    return Response.json(
      { error: "Admin authentication temporarily unavailable" },
      { status: 503 }
    );
  }
  return Response.json({ error: denied.error }, { status: denied.status });
}
