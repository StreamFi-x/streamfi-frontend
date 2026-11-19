/**
 * lib/auth/wallet-recovery.ts
 *
 * Business logic and security verification for non-custodial wallet recovery (#1446).
 */

import { sql } from "@vercel/postgres";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { invalidateUserCaches } from "@/lib/cache/invalidation";

export function hashRecoveryToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Setup a recovery email for an authenticated user.
 */
export async function setupRecoveryEmail(
  userId: string,
  email: string
): Promise<{ verificationCode: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const code = generateVerificationCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  await sql`
    INSERT INTO user_recovery_methods (
      user_id,
      recovery_type,
      recovery_identifier,
      verification_code_hash,
      verification_code_expires_at,
      is_verified,
      updated_at
    )
    VALUES (
      ${userId},
      'email',
      ${normalizedEmail},
      ${codeHash},
      ${expiresAt.toISOString()},
      FALSE,
      NOW()
    )
    ON CONFLICT (user_id, recovery_type)
    DO UPDATE SET
      recovery_identifier = ${normalizedEmail},
      verification_code_hash = ${codeHash},
      verification_code_expires_at = ${expiresAt.toISOString()},
      is_verified = FALSE,
      updated_at = NOW()
  `;

  return { verificationCode: code };
}

/**
 * Verify recovery setup with the 6-digit code.
 */
export async function verifyRecoverySetup(
  userId: string,
  code: string
): Promise<{ ok: boolean; reason?: string }> {
  const { rows } = await sql`
    SELECT id, verification_code_hash, verification_code_expires_at
    FROM user_recovery_methods
    WHERE user_id = ${userId} AND recovery_type = 'email'
    LIMIT 1
  `;

  if (rows.length === 0) {
    return { ok: false, reason: "No pending recovery setup found" };
  }

  const record = rows[0];
  if (new Date(record.verification_code_expires_at) < new Date()) {
    return { ok: false, reason: "Verification code expired" };
  }

  const isValid = await bcrypt.compare(code, record.verification_code_hash);
  if (!isValid) {
    return { ok: false, reason: "Invalid verification code" };
  }

  await sql`
    UPDATE user_recovery_methods
    SET
      is_verified = TRUE,
      verified_at = NOW(),
      verification_code_hash = NULL,
      verification_code_expires_at = NULL,
      updated_at = NOW()
    WHERE id = ${record.id}
  `;

  return { ok: true };
}

/**
 * Request an account recovery challenge for a lost key.
 */
export async function requestAccountRecovery(
  identifier: string,
  newWallet: string,
  ip?: string,
  userAgent?: string
): Promise<{ ok: boolean; recoveryToken?: string; maskedEmail?: string; reason?: string }> {
  // Find user by username or current wallet
  const { rows: users } = await sql`
    SELECT u.id, u.username, u.wallet
    FROM users u
    WHERE u.username = ${identifier} OR u.wallet = ${identifier}
    LIMIT 1
  `;

  if (users.length === 0) {
    return { ok: false, reason: "Account not found" };
  }

  const user = users[0];

  // Check for verified recovery method
  const { rows: recoveryMethods } = await sql`
    SELECT id, recovery_identifier, is_verified
    FROM user_recovery_methods
    WHERE user_id = ${user.id} AND recovery_type = 'email' AND is_verified = TRUE
    LIMIT 1
  `;

  if (recoveryMethods.length === 0) {
    return {
      ok: false,
      reason:
        "No verified recovery method configured for this account. Self-custodied accounts without pre-configured recovery cannot be recovered.",
    };
  }

  const recoveryEmail = recoveryMethods[0].recovery_identifier;
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashRecoveryToken(rawToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  await sql`
    INSERT INTO account_recovery_requests (
      user_id,
      token_hash,
      new_wallet,
      status,
      expires_at,
      ip_address,
      user_agent
    )
    VALUES (
      ${user.id},
      ${tokenHash},
      ${newWallet},
      'pending',
      ${expiresAt.toISOString()},
      ${ip ? ip : null},
      ${userAgent || null}
    )
  `;

  // Mask email: j***n@example.com
  const [localPart, domain] = recoveryEmail.split("@");
  const maskedLocal =
    localPart.length > 2
      ? `${localPart[0]}***${localPart[localPart.length - 1]}`
      : `${localPart[0]}***`;
  const maskedEmail = `${maskedLocal}@${domain}`;

  return {
    ok: true,
    recoveryToken: rawToken,
    maskedEmail,
  };
}

/**
 * Execute recovery and bind new wallet to the account.
 */
export async function executeAccountRecovery(
  token: string,
  newWallet: string
): Promise<{ ok: boolean; userId?: string; previousWallet?: string; reason?: string }> {
  // Validate Stellar public key format
  if (!/^G[A-Z2-7]{55}$/.test(newWallet)) {
    return { ok: false, reason: "Invalid new Stellar wallet address" };
  }

  const tokenHash = hashRecoveryToken(token);

  const { rows: requests } = await sql`
    SELECT r.id, r.user_id, r.new_wallet, r.expires_at, r.status, u.wallet as old_wallet
    FROM account_recovery_requests r
    JOIN users u ON r.user_id = u.id
    WHERE r.token_hash = ${tokenHash} AND r.status = 'pending'
    LIMIT 1
  `;

  if (requests.length === 0) {
    return { ok: false, reason: "Invalid or already used recovery token" };
  }

  const req = requests[0];
  if (new Date(req.expires_at) < new Date()) {
    await sql`UPDATE account_recovery_requests SET status = 'expired' WHERE id = ${req.id}`;
    return { ok: false, reason: "Recovery token has expired" };
  }

  if (req.new_wallet !== newWallet) {
    return { ok: false, reason: "Wallet address does not match initial recovery request" };
  }

  // Ensure new wallet is not already registered to someone else
  const { rows: existingWallet } = await sql`
    SELECT id FROM users WHERE wallet = ${newWallet} AND id != ${req.user_id} LIMIT 1
  `;
  if (existingWallet.length > 0) {
    return { ok: false, reason: "New wallet address is already associated with another account" };
  }

  // Execute wallet rebind & terminate all active sessions for security
  await sql`
    UPDATE users
    SET
      wallet = ${newWallet},
      updated_at = NOW()
    WHERE id = ${req.user_id}
  `;

  await sql`
    DELETE FROM user_sessions WHERE user_id = ${req.user_id}
  `;

  await sql`
    UPDATE account_recovery_requests
    SET
      status = 'completed',
      completed_at = NOW()
    WHERE id = ${req.id}
  `;

  await invalidateUserCaches({
    id: req.user_id,
    wallet: newWallet,
    previousWallet: req.old_wallet,
  });

  return {
    ok: true,
    userId: req.user_id,
    previousWallet: req.old_wallet,
  };
}
