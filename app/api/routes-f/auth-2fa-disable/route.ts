/**
 * POST /api/routes-f/auth-2fa-disable
 *
 * Disables TOTP-based 2FA on the authenticated user's account. Requires a
 * currently valid 6-digit TOTP code, verified against the secret stored by
 * the enrollment flow (auth-2fa-enable / 2fa/setup) on the same
 * user_two_factor row — this route trusts nothing but a live code from the
 * account's own authenticator app before turning 2FA off.
 *
 * On success, clears the stored TOTP secret and any outstanding recovery
 * codes, and flips totp_enabled back to false — the account returns to the
 * same "no 2FA configured" state that auth-2fa-enable started from.
 *
 * Error responses:
 *   400 — invalid body, or invalid/expired TOTP code
 *   401 — unauthorized (no valid session)
 *   409 — 2FA is not currently enabled
 *   500 — database error
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { decryptSecret, verifyTotpToken } from "@/app/api/routes-f/2fa/_lib/totp";

const disableSchema = z.object({
  token: z
    .string()
    .length(6, "Token must be exactly 6 digits")
    .regex(/^\d{6}$/, "Token must be exactly 6 digits"),
});

export async function POST(request: NextRequest) {
  const session = await verifySession(request);
  if (!session.ok) {
    return session.response;
  }

  const body = await validateBody(request, disableSchema);
  if (body instanceof NextResponse) {
    return body;
  }

  try {
    const { rows } = await sql`
      SELECT totp_secret_ciphertext, totp_secret_iv, totp_secret_tag, totp_enabled
      FROM user_two_factor
      WHERE user_id = ${session.userId}
      LIMIT 1
    `;

    if (!rows[0]?.totp_enabled) {
      return NextResponse.json(
        { error: "2FA is not currently enabled on this account." },
        { status: 409 }
      );
    }

    const row = rows[0];
    const secret = decryptSecret({
      ciphertext: row.totp_secret_ciphertext,
      iv: row.totp_secret_iv,
      tag: row.totp_secret_tag,
    });

    if (!verifyTotpToken(secret, body.data.token)) {
      return NextResponse.json({ error: "Invalid or expired TOTP code" }, { status: 400 });
    }

    await sql`
      UPDATE user_two_factor
      SET totp_enabled           = false,
          totp_secret_ciphertext = NULL,
          totp_secret_iv         = NULL,
          totp_secret_tag        = NULL,
          backup_code_hashes     = NULL,
          updated_at             = NOW()
      WHERE user_id = ${session.userId}
    `;

    return NextResponse.json({ disabled: true, message: "2FA has been disabled." });
  } catch (error) {
    console.error("[routes-f auth-2fa-disable POST]", error);
    return NextResponse.json({ error: "Failed to disable 2FA" }, { status: 500 });
  }
}
