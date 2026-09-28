/**
 * POST /api/auth/regenerate-wallet
 *
 * Generates a fresh Stellar keypair for a Privy user and re-encrypts it with
 * the current STELLAR_ENCRYPTION_KEY. The old wallet address is overwritten.
 *
 * ⚠️  Only safe when the user has no balance on the old address — intended for
 *     development/testnet use or when the encryption key has been rotated.
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
import { encryptSecret } from "@/lib/security/encrypted-secrets";
import { consumeStepUp } from "@/lib/security/step-up";

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

  let body: { stepUpChallengeId?: unknown };
  try {body = await req.json();} catch {return NextResponse.json({ error: "Step-up challenge required" }, { status: 403 });}
  if (typeof body.stepUpChallengeId !== "string" || !(await consumeStepUp(session.userId, body.stepUpChallengeId, "wallet_regeneration", session.userId))) {
    return NextResponse.json({ error: "Complete two-factor verification before regenerating the wallet" }, { status: 403 });
  }

  const keypair = Keypair.random();
  const walletPublicKey = keypair.publicKey();

  let encryptedSecret: string;
  try {
    encryptedSecret = encryptSecret(keypair.secret());
  } catch (err) {
    console.error("[regenerate-wallet] Encryption failed:", err);
    return NextResponse.json(
      { error: "Failed to encrypt new wallet — check STELLAR_ENCRYPTION_KEY" },
      { status: 500 }
    );
  }

  try {
    await sql`
      UPDATE users
      SET
        wallet                = ${walletPublicKey},
        encrypted_stellar_key = ${encryptedSecret},
        updated_at            = NOW()
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
