/**
 * POST /api/routes-f/auth-recovery-codes-generate
 *
 * Generates 10 new single-use recovery codes for the authenticated user's
 * 2FA fallback, replacing any codes issued previously. Recovery codes are
 * only meaningful once 2FA is active (they're a bypass for a lost
 * authenticator app), so this route requires `totp_enabled = true` on the
 * same user_two_factor row auth-2fa-enable / auth-2fa-disable operate on —
 * an account without 2FA enabled gets a 409, not a set of codes with
 * nothing for them to unlock.
 *
 * Requires a currently valid 6-digit TOTP code, same as auth-2fa-disable:
 * regenerating recovery codes silently invalidates every code the user
 * already has (e.g. ones written down or stored in a password manager), so
 * it should carry the same proof-of-possession bar as disabling 2FA
 * altogether, not just an active session.
 *
 * Codes are returned once, in plaintext, in the response body — only their
 * SHA-256 hashes are persisted (same storage shape as the codes issued by
 * auth-2fa-confirm / 2fa/verify).
 *
 * Error responses:
 *   400 — invalid body, or invalid/expired TOTP code
 *   401 — unauthorized (no valid session)
 *   409 — 2FA is not enabled on this account
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

const RECOVERY_CODE_COUNT = 10;

const generateSchema = z.object({
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

  const body = await validateBody(request, generateSchema);
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
        { error: "2FA must be enabled before generating recovery codes." },
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

    const codes = generateBackupCodes(RECOVERY_CODE_COUNT);
    const hashedCodes = codes.map((c) => createHash("sha256").update(c).digest("hex"));

    await sql`
      UPDATE user_two_factor
      SET backup_code_hashes = ${JSON.stringify(hashedCodes)},
          updated_at         = NOW()
      WHERE user_id = ${session.userId}
    `;

    return NextResponse.json(
      {
        recoveryCodes: codes,
        message:
          "New recovery codes generated. Store them securely — the previous set no longer works, and these will not be shown again.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[routes-f auth-recovery-codes-generate POST]", error);
    return NextResponse.json({ error: "Failed to generate recovery codes" }, { status: 500 });
  }
}
