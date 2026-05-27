/**
 * Extracts the raw session token string from a Next.js request.
 *
 * Priority order matches verifySession:
 *  1. privy_session cookie  (value IS the raw token — the privy_id string)
 *  2. wallet_session cookie (value IS the raw signed JWT)
 *  3. legacy wallet cookie  (value IS the raw wallet address)
 *
 * Returns null if no session cookie is present.
 */

import { NextRequest } from "next/server";

export function extractRawToken(req: NextRequest): string | null {
  return (
    req.cookies.get("privy_session")?.value ??
    req.cookies.get("wallet_session")?.value ??
    req.cookies.get("wallet")?.value ??
    null
  );
}
