import { NextRequest } from "next/server";
import { verifySession, type VerifiedSession } from "@/lib/auth/verify-session";

export async function getOptionalSession(
  req: NextRequest
): Promise<Extract<VerifiedSession, { ok: true }> | null> {
  const hasSessionCookie =
    req.cookies.has("privy_session") ||
    req.cookies.has("wallet_session") ||
    req.cookies.has("wallet");

  if (!hasSessionCookie) {
    return null;
  }

  const session = await verifySession(req);
  return session.ok ? session : null;
}
