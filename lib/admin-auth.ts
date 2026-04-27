import { cookies } from "next/headers";

/**
 * Verifies the current request belongs to an admin.
 *
 * Admin identity is determined by two env vars (comma-separated lists):
 *   ADMIN_PRIVY_IDS          — Privy user IDs allowed admin access
 *   ADMIN_WALLET_ADDRESSES   — Stellar wallet addresses allowed admin access
 *
 * The `privy_session` cookie (set by POST /api/auth/session) stores the
 * server-verified Privy user ID, so we can check it safely without trusting
 * any client-supplied data.
 */
export async function verifyAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const privySession = cookieStore.get("privy_session")?.value ?? "";

  const allowedPrivyIds = (process.env.ADMIN_PRIVY_IDS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  if (privySession && allowedPrivyIds.includes(privySession)) {
    return true;
  }

  return false;
}

/**
 * Synchronous check used by API routes that already verified a session.
 * Matches `ADMIN_PRIVY_IDS` (comma-separated Privy user IDs).
 */
export function isAdmin(userId: string): boolean {
  const allowedPrivyIds = (process.env.ADMIN_PRIVY_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return Boolean(userId) && allowedPrivyIds.includes(userId);
}

/** Convenience helper — returns a 401 JSON response. */
export function adminUnauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
