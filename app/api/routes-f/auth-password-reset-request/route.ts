/**
 * POST /api/routes-f/auth-password-reset-request
 *
 * Starts a password-reset flow for an account identified by email.
 * Always responds with a generic 200 message, whether or not the email is
 * registered, so the endpoint cannot be used to enumerate accounts.
 *
 * Rate limited per-IP and per-account (email) to slow down abuse — an
 * attacker who can only issue N requests per window per identifier can't
 * spam a victim's inbox or flood the mail provider.
 *
 * On success for a real account:
 *  - Generates a signed, single-use, short-lived reset token.
 *  - Persists only the SHA-256 hash of the token (never the raw value).
 *  - Emails the raw token/link to the account's email address.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { randomBytes } from "crypto";
import { signToken } from "@/lib/auth/sign-token";
import { hashToken } from "@/lib/sessions/user-sessions";
import { createRateLimiter } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/utils/send-email";

// 5 requests per 15 minutes per IP, and per account — generous enough for a
// legitimate user who mistypes their password a few times, tight enough to
// blunt inbox-flooding / brute-force enumeration attempts.
const isIpRateLimited = createRateLimiter(15 * 60 * 1000, 5);
const isAccountRateLimited = createRateLimiter(15 * 60 * 1000, 5);

const RESET_TOKEN_TTL_SECONDS = 30 * 60; // 30 minutes

const requestSchema = z.object({
  email: z.string().trim().email("A valid email is required"),
});

const GENERIC_RESPONSE = {
  message:
    "If an account with that email exists, a password reset link has been sent.",
};

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  if (await isIpRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": "900" } }
    );
  }

  let body: z.infer<typeof requestSchema>;
  try {
    const raw = await request.json();
    const parsed = requestSchema.safeParse(raw);
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

  const email = body.email.toLowerCase();

  // Per-account limiting keyed on the normalized email — independent of IP so
  // a distributed attacker still can't hammer one victim's inbox.
  if (await isAccountRateLimited(email)) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": "900" } }
    );
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error(
      "[routes-f auth-password-reset-request] SESSION_SECRET not configured"
    );
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  try {
    const { rows } = await sql`
      SELECT id, email FROM users WHERE lower(email) = ${email} LIMIT 1
    `;

    // Do not reveal whether the account exists — always return the same
    // generic success response.
    if (rows.length === 0) {
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    const user = rows[0];

    // Random per-request nonce ensures two tokens issued in the same second
    // for the same user never collide, even before hashing.
    const nonce = randomBytes(16).toString("hex");
    const exp = Math.floor(Date.now() / 1000) + RESET_TOKEN_TTL_SECONDS;
    const rawToken = signToken({ userId: user.id, purpose: "password_reset", nonce, exp }, secret);
    const tokenHash = hashToken(rawToken);

    // Invalidate any previously issued, still-unused reset tokens for this
    // user before storing the new one — only the most recent link is valid.
    await sql`
      UPDATE password_reset_tokens
      SET consumed_at = NOW()
      WHERE user_id = ${user.id} AND consumed_at IS NULL
    `;

    await sql`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${tokenHash}, NOW() + INTERVAL '30 minutes')
    `;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    await sendPasswordResetEmail(user.email, resetUrl).catch((err: unknown) => {
      // Do not fail the request just because the email provider hiccuped —
      // log it, but keep the response generic either way.
      console.error(
        "[routes-f auth-password-reset-request] Failed to send email:",
        err
      );
    });

    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  } catch (error) {
    console.error("[routes-f auth-password-reset-request POST]", error);
    return NextResponse.json(
      { error: "Failed to process password reset request" },
      { status: 500 }
    );
  }
}
