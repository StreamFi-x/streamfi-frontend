/**
 * POST /api/routes-f/auth-2fa-confirm
 *
 * Accepts the 6-digit TOTP code generated from the secret issued by
 * POST /api/routes-f/2fa/setup, and finalizes 2FA setup by verifying it
 * and flipping the account's `totp_enabled` flag to true.
 *
 * This is the confirm step of the same setup flow as
 * POST /api/routes-f/2fa/verify (same `user_two_factor` table and TOTP
 * helpers) — kept as its own route so `routes-f/auth-*` consumers have a
 * dedicated endpoint without depending on the nested `2fa/` route group.
 *
 * Error responses:
 *   400 — invalid body, setup not initiated, or wrong/expired code
 *   401 — unauthorized (no valid session)
 *   409 — 2FA is already confirmed and active
 *   500 — database error
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { createHash } from "crypto";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import {
  decryptSecret,
  verifyTotpToken,
  generateBackupCodes,
} from "@/app/api/routes-f/2fa/_lib/totp";

const confirmSchema = z.object({
  token: z.string().length(6, "Token must be exactly 6 digits").regex(/^\d{6}$/),
});

export async function POST(request: NextRequest) {
  const session = await verifySession(request);
  if (!session.ok) {
    return session.response;
  }

  const body = await validateBody(request, confirmSchema);
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

    if (!rows[0]) {
      return NextResponse.json(
        { error: "2FA setup not initiated. Call /api/routes-f/2fa/setup first." },
        { status: 400 }
      );
    }

    if (rows[0].totp_enabled) {
      return NextResponse.json(
        { error: "2FA is already confirmed and active." },
        { status: 409 }
      );
    }

    const secret = decryptSecret({
      ciphertext: rows[0].totp_secret_ciphertext,
      iv: rows[0].totp_secret_iv,
      tag: rows[0].totp_secret_tag,
    });

    if (!verifyTotpToken(secret, body.data.token)) {
      return NextResponse.json({ error: "Invalid or expired TOTP token" }, { status: 400 });
    }

    const codes = generateBackupCodes(5);
    const hashedCodes = codes.map((c) =>
      createHash("sha256").update(c).digest("hex")
    );

    await sql`
      UPDATE user_two_factor
      SET totp_enabled       = true,
          backup_code_hashes = ${JSON.stringify(hashedCodes)},
          updated_at         = NOW()
      WHERE user_id = ${session.userId}
    `;

    return NextResponse.json(
      {
        confirmed: true,
        backupCodes: codes,
        message: "2FA confirmed and enabled. Store these backup codes securely — they will not be shown again.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[routes-f auth-2fa-confirm POST]", error);
    return NextResponse.json({ error: "Failed to confirm 2FA setup" }, { status: 500 });
  }
}
