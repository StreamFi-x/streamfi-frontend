import type { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { extractRawToken } from "@/lib/sessions/extract-raw-token";
import { getClientIp } from "@/lib/security/client-ip";
import {
  adminGuardResponse,
  guardAdminAttempt,
  type AdminAuthMechanism,
  type AdminGuardResult,
} from "@/lib/security/admin-auth-throttle";

export type AdminRole = "support" | "moderator" | "super_admin";

function routePermission(route: string): "support" | "moderation" | "admin" {
  if (route.includes("reports") || route === "admin/me") {
    return "support";
  }
  if (
    route.includes("moderation") ||
    route.includes("admin-user-suspend") ||
    route.includes("admin-user-unsuspend")
  ) {
    return "moderation";
  }
  return "admin";
}

export function roleCanAccess(
  role: string | null,
  permission: "support" | "moderation" | "admin"
): boolean {
  if (role === "super_admin") {
    return true;
  }
  if (permission === "support") {
    return role === "support" || role === "moderator";
  }
  if (permission === "moderation") {
    return role === "moderator";
  }
  return false;
}

export interface AdminIdentity {
  userId: string;
  privyId: string | null;
  role: AdminRole;
}

export type AdminAuthorization =
  | { ok: true; admin: AdminIdentity; response: null }
  | { ok: false; admin: null; response: Response };

/** The only user-admin authorization entry point. Never accepts a caller-selected identity.
 * Authentication runs inside the brute-force guard, before the authoritative role lookup.
 * Audit actors and per-admin limits must use the returned database userId.
 */
export async function authorizeAdmin(
  request: NextRequest,
  route: string
): Promise<AdminAuthorization> {
  let admin: AdminIdentity | null = null;
  let authenticationFailure: Response | null = null;
  const result = await guardAdminAttempt(
    {
      mechanism: "session_role",
      route,
      ip: getClientIp(request.headers),
      credential: extractRawToken(request),
    },
    async () => {
      // The legacy wallet cookie is an unsigned address, not proof of identity.
      if (
        !request.cookies.get("privy_session")?.value &&
        !request.cookies.get("wallet_session")?.value
      ) {
        authenticationFailure = Response.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
        return false;
      }
      const session = await verifySession(request);
      if (!session.ok) {
        authenticationFailure = session.response;
        return false;
      }
      const { rows } = await sql`
        SELECT role FROM users WHERE id = ${session.userId} AND deleted_at IS NULL LIMIT 1
      `;
      const role = rows[0]?.role ?? null;
      // refresh-total historically permits every admin tier; keep that policy explicit.
      const permission =
        route === "tips/refresh-total" ? "support" : routePermission(route);
      if (!roleCanAccess(role, permission)) {
        return false;
      }
      admin = { userId: session.userId, privyId: session.privyId, role };
      return true;
    }
  );
  if (!result.ok) {
    return {
      ok: false,
      admin: null,
      response:
        result.reason === "denied" && authenticationFailure
          ? authenticationFailure
          : adminGuardResponse(result, {
              status: 403,
              error: "Forbidden: Admin access required",
            }),
    };
  }
  // A guard success is meaningful only when its verifier produced an identity.
  if (!admin) {
    throw new Error("Admin guard succeeded without a verified identity");
  }
  return { ok: true, admin, response: null };
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
