/**
 * POST /api/routes-f/auth-2fa-enable
 *
 * Starts a TOTP enrollment flow for the authenticated user: generates a new
 * base32 TOTP secret, stores it (encrypted, with `totp_enabled = false`) on
 * the account's `user_two_factor` row, and returns the secret plus an
 * `otpauth://` URI the client renders as a QR code.
 *
 * This is the same enrollment step as POST /api/routes-f/2fa/setup — kept as
 * its own `routes-f/auth-*` route so callers of the auth-* namespace have a
 * dedicated endpoint without depending on the nested `2fa/` route group
 * (same convention as auth-2fa-confirm alongside 2fa/verify).
 *
 * 2FA is not actually enabled by this call — the account stays with
 * `totp_enabled = false` until the returned secret is confirmed via a valid
 * TOTP code (see auth-2fa-confirm or 2fa/verify). This route only issues the
 * secret and account-state row that #1511 (auth-2fa-disable) and #1512
 * (auth-recovery-codes-generate) build on.
 *
 * Error responses:
 *   401 — unauthorized (no valid session)
 *   409 — 2FA is already enabled on this account
 *   500 — database or encryption error
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import {
  generateTotpSecret,
  buildOtpauthUri,
  encryptSecret,
} from "@/app/api/routes-f/2fa/_lib/totp";

export async function POST(request: NextRequest) {
  const session = await verifySession(request);
  if (!session.ok) {
    return session.response;
  }

  try {
    const { rows } = await sql`
      SELECT totp_enabled FROM user_two_factor WHERE user_id = ${session.userId} LIMIT 1
    `;

    if (rows[0]?.totp_enabled) {
      return NextResponse.json(
        { error: "2FA is already enabled. Disable it before setting up again." },
        { status: 409 }
      );
    }

    const secret = generateTotpSecret();
    const enc = encryptSecret(secret);
    const account = session.email ?? session.username ?? session.userId;
    const otpauthUri = buildOtpauthUri(secret, account);

    await sql`
      INSERT INTO user_two_factor (user_id, totp_secret_ciphertext, totp_secret_iv, totp_secret_tag, totp_enabled, updated_at)
      VALUES (
        ${session.userId},
        ${enc.ciphertext},
        ${enc.iv},
        ${enc.tag},
        false,
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        totp_secret_ciphertext = EXCLUDED.totp_secret_ciphertext,
        totp_secret_iv         = EXCLUDED.totp_secret_iv,
        totp_secret_tag        = EXCLUDED.totp_secret_tag,
        totp_enabled           = false,
        updated_at             = NOW()
    `;

    return NextResponse.json(
      {
        secret,
        otpauthUri,
        message:
          "Scan the QR code (or enter the secret) in your authenticator app, then confirm with a 6-digit code to finish enabling 2FA.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[routes-f auth-2fa-enable POST]", error);
    return NextResponse.json({ error: "Failed to start 2FA enrollment" }, { status: 500 });
  }
}
