/**
 * POST /api/auth/export-key
 *
 * Returns the decrypted Stellar private key (secret seed) for the authenticated
 * Privy user's custodial wallet.
 *
 * Security controls:
 *  - Requires a valid privy_session HttpOnly cookie
 *  - Only works for users with auth_type = 'privy' (custodial wallets)
 *  - Rate-limited: 3 exports per 10 minutes per IP
 *  - Decryption is KMS-mediated (lib/custodial-keys): every export is a KMS
 *    Decrypt call bound to this user, logged by KMS
 *  - The decrypted key is ONLY sent over HTTPS (enforced by Next.js in production)
 *  - Key is never logged
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  CustodialKeyError,
  decryptCustodialSecret,
} from "@/lib/custodial-keys";

// ─── Rate limiter: 3 exports per 10 minutes per IP (stricter than session) ────
const isRateLimited = createRateLimiter(10 * 60 * 1000, 3);

// ─── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Rate limit
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many export requests. Try again in 10 minutes." },
      { status: 429, headers: { "Retry-After": "600" } }
    );
  }

  // 2. Verify session
  const session = await verifySession(req, { allowPendingDeletion: true });
  if (!session.ok) {
    return session.response;
  }

  // 3. Only custodial (Privy) users have an encrypted key to export
  if (!session.privyId) {
    return NextResponse.json(
      { error: "Key export is only available for Google (Privy) accounts" },
      { status: 403 }
    );
  }

  // 4. Fetch the encrypted key from DB
  let encryptedKey: string | null = null;
  try {
    const { rows } = await sql`
      -- tombstone-aware: users can export their key during the deletion grace window
      SELECT encrypted_stellar_key
      FROM users
      WHERE id = ${session.userId}
      LIMIT 1
    `;
    encryptedKey = rows[0]?.encrypted_stellar_key ?? null;
  } catch (err) {
    console.error("[export-key] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  if (!encryptedKey) {
    return NextResponse.json(
      { error: "No custodial wallet found for this account" },
      { status: 404 }
    );
  }

  // 5. Decrypt and return — key never touches logs
  try {
    const secretKey = await decryptCustodialSecret(
      session.userId,
      encryptedKey
    );
    return NextResponse.json({ secretKey });
  } catch (err) {
    console.error(
      "[export-key] Decryption failed:",
      err instanceof CustodialKeyError ? err.code : "unexpected_error"
    );
    if (err instanceof CustodialKeyError && err.transient) {
      return NextResponse.json(
        { error: "Key service temporarily unavailable — please try again" },
        { status: 503, headers: { "Retry-After": "30" } }
      );
    }
    return NextResponse.json(
      { error: "Failed to decrypt key — contact support" },
      { status: 500 }
    );
  }
}
