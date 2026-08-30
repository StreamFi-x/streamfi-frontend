/**
 * POST /api/routes-f/auth-email-verify-request
 *
 * Sends a verification link to a newly added (or changed) email address for
 * the authenticated user. Requires an active session — unlike the password
 * reset flow, this isn't for recovering access, it's for confirming
 * ownership of an email the user just typed into their own account settings.
 *
 * Security notes:
 *  - Requires a verified session (verifySession) — an attacker without a
 *    session can't spam arbitrary inboxes through this endpoint.
 *  - Still rate limited per-account, since a compromised/malicious session
 *    could otherwise be used to spam a single inbox.
 *  - The link's token is signed + single-use, matching the reset-token model.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { randomBytes } from "crypto";
import { verifySession } from "@/lib/auth/verify-session";
import { signToken } from "@/lib/auth/sign-token";
import { hashToken } from "@/lib/sessions/user-sessions";
import { createRateLimiter } from "@/lib/rate-limit";
import { sendEmailVerificationLink } from "@/utils/send-email";

// 3 verification emails per hour per account — plenty for legitimate retries
// (e.g. "I didn't get it, resend"), but not enough to be useful as a spam
// vector against a third party's inbox.
const isRateLimited = createRateLimiter(60 * 60 * 1000, 3);

const VERIFY_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24 hours

const requestSchema = z.object({
  email: z.string().trim().email("A valid email is required"),
});

export async function POST(request: NextRequest) {
  const session = await verifySession(request);
  if (!session.ok) {
    return session.response;
  }

  if (await isRateLimited(session.userId)) {
    return NextResponse.json(
      { error: "Too many verification requests. Try again later." },
      { status: 429, headers: { "Retry-After": "3600" } }
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

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error(
      "[routes-f auth-email-verify-request] SESSION_SECRET not configured"
    );
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  try {
    // Prevent verifying an email address another account already owns and
    // has verified — otherwise two users could both claim the same inbox.
    const { rows: conflictRows } = await sql`
      SELECT id FROM users
      WHERE lower(email) = ${email} AND id != ${session.userId} AND "emailVerified" = true
      LIMIT 1
    `;
    if (conflictRows.length > 0) {
      return NextResponse.json(
        { error: "This email address is already in use" },
        { status: 409 }
      );
    }

    const nonce = randomBytes(16).toString("hex");
    const exp = Math.floor(Date.now() / 1000) + VERIFY_TOKEN_TTL_SECONDS;
    const rawToken = signToken(
      { userId: session.userId, email, purpose: "email_verify", nonce, exp },
      secret
    );
    const tokenHash = hashToken(rawToken);

    // Invalidate any previous unused verification tokens for this user so
    // only the most recently requested link works.
    await sql`
      UPDATE email_verification_tokens
      SET consumed_at = NOW()
      WHERE user_id = ${session.userId} AND consumed_at IS NULL
    `;

    await sql`
      INSERT INTO email_verification_tokens (user_id, email, token_hash, expires_at)
      VALUES (${session.userId}, ${email}, ${tokenHash}, NOW() + INTERVAL '24 hours')
    `;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;

    await sendEmailVerificationLink(email, verifyUrl).catch((err: unknown) => {
      console.error(
        "[routes-f auth-email-verify-request] Failed to send email:",
        err
      );
    });

    return NextResponse.json(
      { message: "Verification link sent. Check your inbox." },
      { status: 200 }
    );
  } catch (error) {
    console.error("[routes-f auth-email-verify-request POST]", error);
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }
}
