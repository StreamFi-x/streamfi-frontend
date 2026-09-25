/**
 * POST /api/auth/regenerate-wallet
 *
 * Generates a fresh Stellar keypair for a Privy user and envelope-encrypts it
 * through KMS (lib/custodial-keys). The old wallet address is overwritten.
 *
 * ⚠️  Only safe when the user has no balance on the old address — intended for
 *     development/testnet use.
 *
 * Security controls:
 *  - Requires a valid privy_session HttpOnly cookie
 *  - Only works for Privy (custodial) users
 *  - Rate-limited: 2 regenerations per 10 minutes per IP
 */

import { NextRequest, NextResponse } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  CustodialKeyError,
  encryptCustodialSecret,
} from "@/lib/custodial-keys";

// ─── Rate limiter: 2 regenerations per 10 minutes per IP ──────────────────────
const isRateLimited = createRateLimiter(10 * 60 * 1000, 2);

// ─── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Try again in 10 minutes." },
      { status: 429, headers: { "Retry-After": "600" } }
    );
  }

  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  if (!session.privyId) {
    return NextResponse.json(
      {
        error: "Only Privy (Google) accounts can regenerate a custodial wallet",
      },
      { status: 403 }
    );
  }

  const keypair = Keypair.random();
  const walletPublicKey = keypair.publicKey();

  let encryptedSecret: string;
  try {
    encryptedSecret = await encryptCustodialSecret(
      session.userId,
      keypair.secret()
    );
  } catch (err) {
    console.error(
      "[regenerate-wallet] Encryption failed:",
      err instanceof CustodialKeyError ? err.code : "unexpected_error"
    );
    const transient = err instanceof CustodialKeyError && err.transient;
    return NextResponse.json(
      {
        error: transient
          ? "Wallet security service is temporarily unavailable — please try again"
          : "Failed to encrypt new wallet",
      },
      { status: transient ? 503 : 500 }
    );
  }

  try {
    await sql`
      UPDATE users
      SET
        wallet                       = ${walletPublicKey},
        encrypted_stellar_key        = ${encryptedSecret},
        -- A legacy backup belongs to the abandoned key; keeping it would
        -- leave a static-key-decryptable secret behind (see #1396).
        encrypted_stellar_key_legacy = NULL,
        updated_at                   = NOW()
      WHERE id = ${session.userId}
    `;
  } catch (err) {
    console.error("[regenerate-wallet] DB update failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, wallet: walletPublicKey });
}
