import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import {
  decryptSecret,
  verifyTotpToken,
  generateBackupCodes,
  encryptSecret,
} from "../_lib/totp";
import { createHash } from "crypto";

const verifySchema = z.object({
  token: z.string().length(6, "Token must be exactly 6 digits").regex(/^\d{6}$/),
});

export async function POST(request: NextRequest) {
  const session = await verifySession(request);
  if (!session.ok) return session.response;

  const body = await validateBody(request, verifySchema);
  if (body instanceof NextResponse) return body;

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
        { error: "2FA is already verified and active." },
        { status: 409 }
      );
    }

    const secret = decryptSecret({
      ciphertext: rows[0].totp_secret_ciphertext,
      iv: rows[0].totp_secret_iv,
      tag: rows[0].totp_secret_tag,
    });

    if (!verifyTotpToken(secret, body.data.token)) {
      return NextResponse.json({ error: "Invalid TOTP token" }, { status: 400 });
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
        enabled: true,
        backupCodes: codes,
        message: "2FA enabled. Store these backup codes securely — they will not be shown again.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[routes-f 2fa/verify POST]", error);
    return NextResponse.json({ error: "Failed to verify 2FA token" }, { status: 500 });
  }
}
