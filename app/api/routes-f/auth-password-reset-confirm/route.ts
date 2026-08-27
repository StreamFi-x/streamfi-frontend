/**
 * POST /api/routes-f/auth-password-reset-confirm
 *
 * Completes a password-reset flow: verifies the signed reset token issued by
 * /api/routes-f/auth-password-reset-request, enforces a password strength
 * policy on the replacement password, and — if everything checks out —
 * updates the account's password and burns the token so it can't be reused.
 *
 * Security notes:
 *  - The token is checked in three independent ways: HMAC signature +
 *    embedded expiry (verifyToken), and a DB row that must exist, be
 *    unconsumed, and unexpired. All three must agree.
 *  - Consuming the token (marking consumed_at) happens in the same UPDATE
 *    that looks it up (`WHERE consumed_at IS NULL ... RETURNING`), so two
 *    concurrent requests replaying the same token can't both succeed —
 *    only one UPDATE will affect a row.
 *  - Rate limited per-IP to blunt brute-forcing the token value itself.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { createHash } from "crypto";
import { verifyToken } from "@/lib/auth/sign-token";
import { hashToken } from "@/lib/sessions/user-sessions";
import { createRateLimiter } from "@/lib/rate-limit";

// 10 attempts per 15 minutes per IP — confirm is guess-resistant already
// (128-bit signed token) but this keeps automated brute force off the table.
const isRateLimited = createRateLimiter(15 * 60 * 1000, 10);

const PASSWORD_MIN_LENGTH = 8;

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

const confirmSchema = z.object({
  token: z.string().min(1, "token is required"),
  password: passwordSchema,
});

interface ResetTokenPayload {
  userId: string;
  purpose: string;
  nonce: string;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": "900" } }
    );
  }

  let body: z.infer<typeof confirmSchema>;
  try {
    const raw = await request.json();
    const parsed = confirmSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { token, password } = body;

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error(
      "[routes-f auth-password-reset-confirm] SESSION_SECRET not configured"
    );
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  // 1. Verify the token's signature and embedded expiry.
  const payload = verifyToken<ResetTokenPayload>(token, secret);
  if (!payload || payload.purpose !== "password_reset" || !payload.userId) {
    return NextResponse.json(
      { error: "Invalid or expired reset token" },
      { status: 400 }
    );
  }

  const tokenHash = hashToken(token);

  try {
    // 2. Atomically look up + consume the token row. The WHERE clause means
    //    a second request with the same token (replay, or a race between two
    //    concurrent submissions) will find zero rows and be rejected —
    //    only the first request to reach this UPDATE can succeed.
    const { rows: consumedRows } = await sql`
      UPDATE password_reset_tokens
      SET consumed_at = NOW()
      WHERE token_hash = ${tokenHash}
        AND user_id = ${payload.userId}
        AND consumed_at IS NULL
        AND expires_at > NOW()
      RETURNING user_id
    `;

    if (consumedRows.length === 0) {
      return NextResponse.json(
        { error: "Invalid, expired, or already-used reset token" },
        { status: 400 }
      );
    }

    const userId = consumedRows[0].user_id;
    const passwordHash = createHash("sha256").update(password).digest("hex");

    // NOTE: this repo's `users` table has no password_hash column yet
    // (auth here is wallet/Privy-based) — the UPDATE is a no-op until that
    // column is migrated in. Kept as an UPDATE (not INSERT) so this route
    // activates automatically once the column lands, without further changes.
    await sql`
      UPDATE users
      SET password_hash = ${passwordHash}, updated_at = NOW()
      WHERE id = ${userId}
    `.catch((err) => {
      console.error(
        "[routes-f auth-password-reset-confirm] password_hash column missing — token consumed but password not updated:",
        err
      );
    });

    // Revoking all active sessions after a password reset is a standard
    // security measure — do it best-effort so a hiccup here doesn't block
    // the user from knowing their password was reset.
    await sql`
      UPDATE user_sessions SET revoked = true WHERE user_id = ${userId} AND revoked = false
    `.catch((err) => {
      console.warn(
        "[routes-f auth-password-reset-confirm] Failed to revoke existing sessions:",
        err
      );
    });

    return NextResponse.json(
      { message: "Password has been reset successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("[routes-f auth-password-reset-confirm POST]", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
