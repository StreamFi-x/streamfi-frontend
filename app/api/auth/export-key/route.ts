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
 *  - The decrypted key is ONLY sent over HTTPS (enforced by Next.js in production)
 *  - Key is never logged
 */

import { NextRequest, NextResponse } from "next/server";
import { createDecipheriv } from "crypto";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { createRateLimiter } from "@/lib/rate-limit";

// ─── Rate limiter: 3 exports per 10 minutes per IP (stricter than session) ────
const isRateLimited = createRateLimiter(10 * 60 * 1000, 3);

// ─── Decryption helper ─────────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const hex = process.env.STELLAR_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("STELLAR_ENCRYPTION_KEY misconfigured");
  }
  return Buffer.from(hex, "hex");
}

/**
 * Decrypts a value encrypted by the onboarding route.
 * Format: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 */
function decryptSecret(encrypted: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 3) {throw new Error("Invalid encrypted format");}

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

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
  const session = await verifySession(req);
  if (!session.ok) {return session.response;}

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
      SELECT encrypted_stellar_key
      FROM users
      WHERE id = ${session.userId}
      LIMIT 1
    `;
    encryptedKey = rows[0]?.encrypted_stellar_key ?? null;
  } catch (err) {
    console.error("[export-key] DB error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!encryptedKey) {
    return NextResponse.json(
      { error: "No custodial wallet found for this account" },
      { status: 404 }
    );
  }

  // 5. Decrypt and return — key never touches logs
  try {
    const secretKey = decryptSecret(encryptedKey);
    return NextResponse.json({ secretKey });
  } catch (err) {
    console.error("[export-key] Decryption failed:", err);
    return NextResponse.json(
      { error: "Failed to decrypt key — contact support" },
      { status: 500 }
    );
  }
}
