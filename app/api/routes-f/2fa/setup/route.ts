import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import {
  generateTotpSecret,
  buildOtpauthUri,
  encryptSecret,
} from "../_lib/totp";

export async function POST(request: NextRequest) {
  const session = await verifySession(request);
  if (!session.ok) return session.response;

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
    const otpauthUri = buildOtpauthUri(secret, session.userId);

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

    return NextResponse.json({ otpauthUri }, { status: 200 });
  } catch (error) {
    console.error("[routes-f 2fa/setup POST]", error);
    return NextResponse.json({ error: "Failed to initiate 2FA setup" }, { status: 500 });
  }
}
