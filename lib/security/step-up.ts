import { sql } from "@vercel/postgres";
import { authenticator } from "otplib";
import { compare } from "bcryptjs";
import { decryptSecret } from "@/lib/security/encrypted-secrets";

export const STEP_UP_ACTIONS = [
  "wallet_export",
  "wallet_regeneration",
  "admin_user_ban",
  "admin_user_delete",
] as const;
export type StepUpAction = (typeof STEP_UP_ACTIONS)[number];

export async function verifyTotp(userId: string, code: string): Promise<boolean> {
  const { rows } = await sql`SELECT totp_secret_enc FROM users WHERE id = ${userId} AND totp_enabled = true`;
  if (!rows[0]?.totp_secret_enc) {return false;}
  try {
    const secret = decryptSecret(rows[0].totp_secret_enc, "TOTP");
    return authenticator.verify({ token: code.replace(/\s/g, ""), secret, window: 1 });
  } catch {
    return false;
  }
}

export async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const { rows } = await sql`SELECT id, code_hash FROM step_up_recovery_codes WHERE user_id = ${userId} AND used_at IS NULL`;
  for (const row of rows) {
    if (await compare(code.toUpperCase(), row.code_hash)) {
      const consumed = await sql`UPDATE step_up_recovery_codes SET used_at = now() WHERE id = ${row.id} AND user_id = ${userId} AND used_at IS NULL RETURNING id`;
      return consumed.rows.length === 1;
    }
  }
  return false;
}

export async function consumeStepUp(userId: string, challengeId: string, action: StepUpAction, resourceId: string): Promise<boolean> {
  const { rows } = await sql`
    UPDATE step_up_challenges
    SET consumed_at = now()
    WHERE id = ${challengeId} AND user_id = ${userId} AND action = ${action}
      AND resource_id = ${resourceId} AND verified_at IS NOT NULL
      AND consumed_at IS NULL AND expires_at > now() AND failed_attempts < 5
    RETURNING id
  `;
  return rows.length === 1;
}