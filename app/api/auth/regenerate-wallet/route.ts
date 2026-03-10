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
import { createCipheriv, randomBytes } from "crypto";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { createRateLimiter } from "@/lib/rate-limit";

// ─── Rate limiter: 2 regenerations per 10 minutes per IP ──────────────────────
const isRateLimited = createRateLimiter(10 * 60 * 1000, 2);

// ─── Encryption ────────────────────────────────────────────────────────────────
function getEncryptionKey(): Buffer {
  const hex = process.env.STELLAR_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("STELLAR_ENCRYPTION_KEY misconfigured");
  }
  return Buffer.from(hex, "hex");
}

function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

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
