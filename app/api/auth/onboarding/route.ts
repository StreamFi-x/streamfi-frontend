/**
 * POST /api/auth/onboarding
 *
 * Completes the onboarding step for a Privy (Google) user:
 *  1. Verifies their privy_session cookie (server-side DB cross-check)
 *  2. Validates the chosen username
 *  3. Generates a fresh Stellar keypair (custodial)
 *  4. Encrypts the private key with AES-256-GCM using STELLAR_ENCRYPTION_KEY
 *  5. Updates the user's DB row with username, wallet (public key), encrypted secret
 *
 * The encrypted private key never leaves the server unencrypted.
 * Users can export it later via /api/auth/export-key (authenticated, rate-limited).
 */

import { NextRequest, NextResponse } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";
import { createCipheriv, randomBytes } from "crypto";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

// ─── Encryption helpers ────────────────────────────────────────────────────────

/**
 * Derives a 32-byte key from the env variable.
 * STELLAR_ENCRYPTION_KEY must be a 64-char hex string (32 bytes).
 */
function getEncryptionKey(): Buffer {
  const hex = process.env.STELLAR_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "STELLAR_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns a single string: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 */
function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12); // 96-bit IV — recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 16-byte GCM auth tag

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

// ─── Username validation ───────────────────────────────────────────────────────

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

function validateUsername(username: string): string | null {
  if (!username?.trim()) return "Username is required";
  if (!USERNAME_RE.test(username))
    return "Username must be 3–30 characters: letters, numbers, underscores only";
  return null;
}

// ─── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Verify the Privy session cookie — identity comes from the server, never the body
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  // Only Privy users go through this flow
  if (!session.privyId) {
    return NextResponse.json(
      { error: "This endpoint is for Privy (Google) users only" },
      { status: 403 }
    );
  }

  // 2. Parse and validate request body
  let body: { username?: string; bio?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const usernameError = validateUsername(body.username ?? "");
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }

  // Normalize to lowercase — all usernames stored as lowercase to prevent
  // case-variant duplicates (e.g. "DumDumboi" vs "dumdumboi")
  const username = body.username!.trim().toLowerCase();
  const bio = body.bio?.trim() ?? null;

  // 3. Check username isn't already taken (case-insensitive via stored lowercase)
  try {
    const { rows: existing } = await sql`
      SELECT id FROM users WHERE username = ${username} AND id != ${session.userId}
      LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
  } catch (err) {
    console.error("[onboarding] Username check failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // 4. If user already has a wallet (e.g. re-visiting onboarding), skip keygen
  let walletPublicKey = session.wallet;
  let encryptedSecret: string | null = null;

  if (!walletPublicKey) {
    // Generate a fresh Stellar keypair
    const keypair = Keypair.random();
    walletPublicKey = keypair.publicKey();

    try {
      encryptedSecret = encryptSecret(keypair.secret());
    } catch (err) {
      console.error("[onboarding] Encryption failed:", err);
      return NextResponse.json(
        { error: "Failed to secure wallet — check STELLAR_ENCRYPTION_KEY" },
        { status: 500 }
      );
    }
  }

  // 5. Update the user's row using the actual DB column names:
  //    encrypted_stellar_key (not encrypted_stellar_secret), auth_type already exists
  try {
    if (encryptedSecret) {
      await sql`
        UPDATE users
        SET
          username              = ${username},
          wallet                = ${walletPublicKey},
          encrypted_stellar_key = ${encryptedSecret},
          auth_type             = 'privy',
          bio                   = COALESCE(${bio}, bio),
          updated_at            = NOW()
        WHERE id = ${session.userId}
      `;
    } else {
      // Wallet already existed — just update username/bio
      await sql`
        UPDATE users
        SET
          username   = ${username},
          auth_type  = 'privy',
          bio        = COALESCE(${bio}, bio),
          updated_at = NOW()
        WHERE id = ${session.userId}
      `;
    }
  } catch (err: unknown) {
    console.error("[onboarding] DB update failed:", err);
    // Unique constraint on wallet (another user has this key — extremely unlikely but guard it)
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    username,
    wallet: walletPublicKey,
    // Note: we never return the secret key in this response
  });
}
