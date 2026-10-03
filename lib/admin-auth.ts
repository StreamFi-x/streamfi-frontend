import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { sql } from "@vercel/postgres";
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
 * Admin identity and privileges are determined by the user's database role.
 *
 * The `privy_session` cookie (set by POST /api/auth/session) stores the
 * server-verified Privy user ID. Every admin check runs behind the
 * admin-specific brute-force guard in lib/security/admin-auth-throttle.ts,
 * which throttles failed attempts with escalating backoff and alerts staff.
 */

const UNDEFINED_TABLE = "42P01";

export type AdminRole = "support" | "moderator" | "super_admin";

function routePermission(route: string): "support" | "moderation" | "admin" {
  if (route.includes("reports") || route === "admin/me") {return "support";}
  if (route.includes("moderation") || route.includes("admin-user-suspend") || route.includes("admin-user-unsuspend")) {
    return "moderation";
  }
  return "admin";
}

export function roleCanAccess(role: string | null, permission: "support" | "moderation" | "admin"): boolean {
  if (role === "super_admin") {return true;}
  if (permission === "support") {return role === "support" || role === "moderator";}
  if (permission === "moderation") {return role === "moderator";}
  return false;
}

export async function getAdminRole(userId: string): Promise<AdminRole | null> {
  const { rows } = await sql`
    SELECT role FROM users WHERE id = ${userId} AND deleted_at IS NULL LIMIT 1
  `;
  const role = rows[0]?.role;
  return role === "support" || role === "moderator" || role === "super_admin"
    ? role
    : null;
}

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
      if (!privySession || !(await hasActiveSession(privySession))) {return false;}
      const { rows } = await sql`
        SELECT role FROM users WHERE privy_id = ${privySession} AND deleted_at IS NULL LIMIT 1
      `;
      return roleCanAccess(rows[0]?.role ?? null, routePermission(route));
    }
  );
}

/**
 * Route guard that also returns the admin's Privy user ID, so admin actions
 * (deletion cancellation, remediation, audits) can be attributed in audit
 * records. Same checks and responses as requireAdminSession.
 */
export async function requireAdminIdentity(
  route: string
): Promise<
  { admin: string; response: null } | { admin: null; response: Response }
> {
  const result = await authorizeAdminSession(route);
  if (!result.ok) {
    return { admin: null, response: adminGuardResponse(result) };
  }
  const privySession = (await cookies()).get("privy_session")?.value ?? "";
  return { admin: privySession, response: null };
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

/**
 * The Privy ID behind the current admin session, for keying per-admin limits.
 * Only meaningful after requireAdminSession / authorizeAdminSession passed.
 */
export async function currentAdminPrivyId(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.get("privy_session")?.value ?? "";
}

/** Database-backed compatibility helper for routes that need any admin tier. */
export async function isAdmin(userId: string): Promise<boolean> {
  return (await getAdminRole(userId)) !== null;
}

/**
 * Throttled admin check for routes that already verified a user session.
 * The shared database role and route capability map are authoritative.
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
    /** @deprecated Retained for caller compatibility; database role policy is authoritative. */
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
    async () => {
      const { rows } = await sql`
        SELECT role FROM users WHERE id = ${opts.userId} AND deleted_at IS NULL LIMIT 1
      `;
      return roleCanAccess(rows[0]?.role ?? null, routePermission(opts.route));
    }
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
