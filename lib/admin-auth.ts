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
  return (await getAdminIdentity()) !== null;
}

/**
 * The admin's Privy user ID, or null when the request is not from an admin.
 * Used to attribute admin actions (deletion cancellation, remediation) in
 * audit records.
 */
export async function getAdminIdentity(): Promise<string | null> {
  const cookieStore = await cookies();
  const privySession = cookieStore.get("privy_session")?.value ?? "";

  const allowedPrivyIds = (process.env.ADMIN_PRIVY_IDS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  if (privySession && allowedPrivyIds.includes(privySession)) {
    return privySession;
  }

  return null;
}

/** Convenience helper — returns a 401 JSON response. */
export function adminUnauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
