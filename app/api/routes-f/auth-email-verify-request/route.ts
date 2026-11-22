/**
 * POST /api/routes-f/auth-email-verify-request
 *
 * Sends a verification link to a newly added (or changed) email address for
 * the authenticated user. Requires an active session — unlike the password
 * reset flow, this isn't for recovering access, it's for confirming
 * ownership of an email the user just typed into their own account settings.
 */

import { type NextRequest, NextResponse } from "next/server";
import { transitionEmailVerification, type EmailAccountSnapshot, emailsEqual } from "@/lib/auth/email-reverification";
import { createSanitizedErrorResponse } from "@/lib/api/error-response";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { randomBytes } from "crypto";
import { verifySession } from "@/lib/auth/verify-session";
import { signToken } from "@/lib/auth/sign-token";
import { hashToken } from "@/lib/sessions/user-sessions";
import { createRateLimiter } from "@/lib/rate-limit";
import { sendEmailVerificationLink } from "@/utils/send-email";

// 3 verification emails per hour per account — plenty for legitimate retries
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

  // Parse and validate request body
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
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  try {
    // 1. Prevent email collision with another verified account
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

    // 2. Load current user snapshot
    const userResult = await sql`
      SELECT email, emailverified, pending_email, email_change_status, previous_verified_email
      FROM users WHERE id = ${session.userId}`;
    const userRow =
      Array.isArray(userResult?.rows) && userResult.rows.length > 0
        ? userResult.rows[0]
        : null;
    const currentUser: EmailAccountSnapshot = userRow
      ? {
          email: userRow.email,
          emailVerified: userRow.emailverified,
          pendingEmail: userRow.pending_email,
          pendingEmailRequestedAt: userRow.pending_email_requested_at,
          emailChangeStatus: userRow.email_change_status,
          emailChangeFailureReason: userRow.email_change_failure_reason,
          previousVerifiedEmail: userRow.previous_verified_email,
        }
      : {
          email: null,
          emailVerified: false,
          pendingEmail: null,
          pendingEmailRequestedAt: null,
          emailChangeStatus: "none",
          emailChangeFailureReason: null,
          previousVerifiedEmail: null,
        };

    // 3. Conflict if already verified with the same email
    if (currentUser.emailVerified && emailsEqual(currentUser.email, email)) {
      return NextResponse.json({ error: "Email already verified" }, { status: 409 });
    }

    // 4. Transition state machine
    const transition = transitionEmailVerification(currentUser, {
      type: "REQUEST_CHANGE",
      newEmail: email,
    });

    // 5. Persist pending fields if user was already verified
    if (currentUser.emailVerified) {
      await sql`
        UPDATE users SET
          pending_email = ${transition.snapshot.pendingEmail},
          pending_email_requested_at = NOW(),
          email_change_status = ${transition.snapshot.emailChangeStatus},
          email_change_failure_reason = NULL,
          previous_verified_email = ${transition.snapshot.previousVerifiedEmail}
        WHERE id = ${session.userId}`;
    }

    // 6. Invalidate any previous unused verification tokens for this user
    await sql`
      UPDATE email_verification_tokens SET consumed_at = NOW()
      WHERE user_id = ${session.userId} AND consumed_at IS NULL`;

    // 7. Generate new token and store it
    const nonce = randomBytes(16).toString("hex");
    const exp = Math.floor(Date.now() / 1000) + VERIFY_TOKEN_TTL_SECONDS;
    const rawToken = signToken(
      { userId: session.userId, email, purpose: "email_verify", nonce, exp },
      secret
    );
    const tokenHash = hashToken(rawToken);
    await sql`
      INSERT INTO email_verification_tokens (user_id, email, token_hash, expires_at)
      VALUES (${session.userId}, ${email}, ${tokenHash}, NOW() + INTERVAL '24 hours')`;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;

    // 8. Send verification email with delivery‑bounce handling
    try {
      await sendEmailVerificationLink(email, verifyUrl);
    } catch (err) {
      console.error(
        "[routes-f auth-email-verify-request] Failed to send email:",
        err
      );
      if (currentUser.emailVerified) {
        // Consume the token we just created
        await sql`
          UPDATE email_verification_tokens SET consumed_at = NOW()
          WHERE user_id = ${session.userId} AND token_hash = ${tokenHash} AND consumed_at IS NULL`;
        // Transition to delivery bounced
        const bounceTransition = transitionEmailVerification(currentUser, {
          type: "DELIVERY_BOUNCED",
          reason: "Email delivery failed",
        });
        await sql`
          UPDATE users SET
            email_change_status = ${bounceTransition.snapshot.emailChangeStatus},
            email_change_failure_reason = ${bounceTransition.snapshot.emailChangeFailureReason}
          WHERE id = ${session.userId}`;
        await invalidateUserCaches({ id: session.userId });
        return NextResponse.json(
          {
            message:
              "Email delivery failed; previous verified email remains active.",
            deliveryFailed: true,
            state: "change_failed",
            canRollback: true,
            email: currentUser.email,
          },
          { status: 200 }
        );
      }
      // For unverified users we simply log the error (already logged above)
    }

    // 9. Invalidate caches before returning success
    await invalidateUserCaches({ id: session.userId });

    return NextResponse.json(
      { message: "Verification link sent. Check your inbox." },
      { status: 200 }
    );
  } catch (error) {
    return createSanitizedErrorResponse(error, {
      context: "routes-f auth-email-verify-request POST",
      publicMessage: "Failed to send verification email",
    });
  }
}
