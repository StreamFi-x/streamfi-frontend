import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { findActiveSession } from "@/lib/sessions/user-sessions";
import { getClientIp } from "@/lib/security/client-ip";
import {
  adminGuardResponse,
  guardAdminAttempt,
  type AdminAuthMechanism,
  type AdminGuardResult,
} from "@/lib/security/admin-auth-throttle";

/**
 * Admin authorization.
 *
 * Admin identity is determined by two env vars (comma-separated lists):
 *   ADMIN_PRIVY_IDS          — Privy user IDs allowed admin access
 *   ADMIN_WALLET_ADDRESSES   — Stellar wallet addresses allowed admin access
 *
 * The `privy_session` cookie (set by POST /api/auth/session) stores the
 * server-verified Privy user ID. Every admin check runs behind the
 * admin-specific brute-force guard in lib/security/admin-auth-throttle.ts,
 * which throttles failed attempts with escalating backoff and alerts staff.
 */

function envList(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

const UNDEFINED_TABLE = "42P01";

/**
 * A revoked or expired session must not keep admin rights. Mirrors
 * verifySession's rollout fallback: only a missing user_sessions table
 * (pre-migration) skips the check — any other DB error propagates.
 */
async function hasActiveSession(rawToken: string): Promise<boolean> {
  try {
    return (await findActiveSession(rawToken)) !== null;
  } catch (err) {
    if ((err as { code?: string } | null)?.code === UNDEFINED_TABLE) {
      return true;
    }
    throw err;
  }
}

/**
 * Authorizes the current request as an admin via the privy_session cookie.
 * @param route label used in security logs and alerts, e.g. "admin/users"
 */
export async function authorizeAdminSession(
  route: string
): Promise<AdminGuardResult> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const privySession = cookieStore.get("privy_session")?.value ?? "";

  return guardAdminAttempt(
    {
      mechanism: "privy_session_allowlist",
      route,
      ip: getClientIp(headerStore),
      credential: privySession || null,
    },
    async () => {
      if (!privySession || !envList("ADMIN_PRIVY_IDS").includes(privySession)) {
        return false;
      }
      return hasActiveSession(privySession);
    }
  );
}

/** Boolean form of authorizeAdminSession, kept for existing callers. */
export async function verifyAdminSession(route = "unknown"): Promise<boolean> {
  return (await authorizeAdminSession(route)).ok;
}

/**
 * Route guard: returns null when the caller is an admin, otherwise the
 * response to send (401, 429 with Retry-After, or 503).
 */
export async function requireAdminSession(
  route: string
): Promise<Response | null> {
  const result = await authorizeAdminSession(route);
  return result.ok ? null : adminGuardResponse(result);
}

/** Returns true when userId is in the ADMIN_PRIVY_IDS or ADMIN_WALLET_ADDRESSES env lists. */
export function isAdmin(userId: string): boolean {
  return (
    envList("ADMIN_PRIVY_IDS").includes(userId) ||
    envList("ADMIN_WALLET_ADDRESSES").includes(userId)
  );
}

/**
 * Throttled admin check for routes that authenticate the user first
 * (verifySession) and then authorize them as admin by some other rule —
 * a users.role lookup or the isAdmin() allowlist.
 */
export async function requireAdminPrincipal(
  req: NextRequest,
  opts: {
    mechanism: Extract<
      AdminAuthMechanism,
      "session_role" | "session_allowlist"
    >;
    route: string;
    userId: string;
    check: () => Promise<boolean> | boolean;
  }
): Promise<Response | null> {
  const result = await guardAdminAttempt(
    {
      mechanism: opts.mechanism,
      route: opts.route,
      ip: getClientIp(req.headers),
      credential: opts.userId,
    },
    async () => opts.check()
  );
  return result.ok
    ? null
    : adminGuardResponse(result, {
        status: 403,
        error: "Forbidden: Admin access required",
      });
}

function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Throttled constant-time check of a shared admin secret presented in a
 * request header (e.g. x-admin-token, x-internal-secret). An unset secret
 * never matches.
 */
export async function requireAdminSecret(
  req: NextRequest,
  opts: {
    mechanism: Extract<
      AdminAuthMechanism,
      "static_admin_token" | "internal_secret"
    >;
    route: string;
    header: string;
    secret: string | undefined;
  }
): Promise<AdminGuardResult> {
  const provided = req.headers.get(opts.header) ?? "";
  return guardAdminAttempt(
    {
      mechanism: opts.mechanism,
      route: opts.route,
      ip: getClientIp(req.headers),
      credential: provided || null,
    },
    async () =>
      Boolean(opts.secret) &&
      provided.length > 0 &&
      secretsEqual(provided, opts.secret as string)
  );
}

/** Convenience helper — returns a 401 JSON response. */
export function adminUnauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
