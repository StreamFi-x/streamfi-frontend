/**
 * POST /api/routes-f/auth-email-verify-confirm (#1516)
 *
 * Completes the email verification flow: verifies the signed token issued
 * by /api/routes-f/auth-email-verify-request, and — if everything checks
 * out — marks the account's email address verified and burns the token so
 * it can't be reused.
 *
 * Security notes:
 *  - The token is checked in three independent ways: HMAC signature +
 *    embedded expiry (verifyToken), and a DB row that must exist, be
 *    unconsumed, and unexpired. All three must agree.
 *  - Consuming the token (marking consumed_at) happens in the same UPDATE
 *    that looks it up (`WHERE consumed_at IS NULL ... RETURNING`), so two
 *    concurrent requests replaying the same token can't both succeed —
 *    only one UPDATE will affect a row (mirrors
 *    routes-f/auth-password-reset-confirm's atomic-consume pattern).
 *  - The email marked verified is the one stored on the token row (set at
 *    request time), not a caller-supplied value — a confirm request never
 *    trusts a client-supplied email/userId pairing.
 *  - Rate limited per-IP to blunt brute-forcing the token value itself.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/auth/sign-token";
import { hashToken } from "@/lib/sessions/user-sessions";
import { createRateLimiter } from "@/lib/rate-limit";

// 10 attempts per 15 minutes per IP — confirm is guess-resistant already
// (128-bit signed token) but this keeps automated brute force off the table.
const isRateLimited = createRateLimiter(15 * 60 * 1000, 10);

const confirmSchema = z.object({
  token: z.string().min(1, "token is required"),
});

interface EmailVerifyTokenPayload {
  userId: string;
  email: string;
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

  const { token } = body;

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error(
      "[routes-f auth-email-verify-confirm] SESSION_SECRET not configured"
    );
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  // 1. Verify the token's signature and embedded expiry.
  const payload = verifyToken<EmailVerifyTokenPayload>(token, secret);
  if (!payload || payload.purpose !== "email_verify" || !payload.userId) {
    return NextResponse.json(
      { error: "Invalid or expired verification token" },
      { status: 400 }
    );
  }

  const tokenHash = hashToken(token);

  try {
    // 2. Atomically look up + consume the token row. The WHERE clause means
    //    a second request with the same token (replay, or a race between two
    //    concurrent submissions) will find zero rows and be rejected — only
    //    the first request to reach this UPDATE can succeed.
    const { rows: consumedRows } = await sql`
      UPDATE email_verification_tokens
      SET consumed_at = NOW()
      WHERE token_hash = ${tokenHash}
        AND user_id = ${payload.userId}
        AND consumed_at IS NULL
        AND expires_at > NOW()
      RETURNING user_id, email
    `;

    if (consumedRows.length === 0) {
      return NextResponse.json(
        { error: "Invalid, expired, or already-used verification token" },
        { status: 400 }
      );
    }

    const { user_id: userId, email } = consumedRows[0];

    await sql`
      UPDATE users
      SET emailverified = true, email = ${email}, updated_at = NOW()
      WHERE id = ${userId}
    `;

    return NextResponse.json(
      { message: "Email address verified successfully.", email },
      { status: 200 }
    );
  } catch (error) {
    console.error("[routes-f auth-email-verify-confirm POST]", error);
    return NextResponse.json(
      { error: "Failed to verify email" },
      { status: 500 }
    );
  }
}
