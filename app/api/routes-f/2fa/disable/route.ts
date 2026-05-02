import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { createHash } from "crypto";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { decryptSecret, verifyTotpToken } from "../_lib/totp";

const disableSchema = z.object({
  token: z
    .string()
    .length(6)
    .regex(/^\d{6}$/)
    .optional(),
  backupCode: z.string().min(1).optional(),
}).refine((d) => d.token !== undefined || d.backupCode !== undefined, {
  message: "Provide either a TOTP token or a backup code",
});

export async function POST(request: NextRequest) {
  const session = await verifySession(request);
  if (!session.ok) return session.response;

  const body = await validateBody(request, disableSchema);
  if (body instanceof NextResponse) return body;

  try {
    const { rows } = await sql`
      SELECT totp_secret_ciphertext, totp_secret_iv, totp_secret_tag,
             totp_enabled, backup_code_hashes
      FROM user_two_factor
      WHERE user_id = ${session.userId}
      LIMIT 1
    `;

    if (!rows[0]?.totp_enabled) {
      return NextResponse.json(
        { error: "2FA is not currently enabled." },
        { status: 400 }
      );
    }

    const row = rows[0];
    let authorized = false;

    if (body.data.token) {
      const secret = decryptSecret({
        ciphertext: row.totp_secret_ciphertext,
        iv: row.totp_secret_iv,
        tag: row.totp_secret_tag,
      });
      authorized = verifyTotpToken(secret, body.data.token);
    } else if (body.data.backupCode) {
      const stored: string[] = JSON.parse(row.backup_code_hashes ?? "[]");
      const hash = createHash("sha256")
        .update(body.data.backupCode.toUpperCase())
        .digest("hex");
      const idx = stored.indexOf(hash);
      if (idx !== -1) {
        authorized = true;
        stored.splice(idx, 1);
        await sql`
          UPDATE user_two_factor
          SET backup_code_hashes = ${JSON.stringify(stored)}, updated_at = NOW()
          WHERE user_id = ${session.userId}
        `;
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Invalid token or backup code" }, { status: 401 });
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

    return NextResponse.json({ disabled: true });
  } catch (error) {
    console.error("[routes-f 2fa/disable POST]", error);
    return NextResponse.json({ error: "Failed to disable 2FA" }, { status: 500 });
  }
}
