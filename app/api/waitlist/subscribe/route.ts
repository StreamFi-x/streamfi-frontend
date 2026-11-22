import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { validateEmail } from "../../../../utils/validators";
import { sendWelcomeEmail } from "../../../../utils/send-email";
import {
  apiBadRequest,
  apiCreated,
  apiInternalError,
  apiSuccess,
} from "@/lib/api";
import { executeEmailWithRetryAndDeadLetter } from "@/lib/email/reliable-sender";
import { logger } from "@/lib/tracing/logger";

export async function POST(req: NextRequest) {
  let body: { email?: string; name?: string | null };
  try {
    body = await req.json();
  } catch {
    return apiBadRequest("Invalid request format");
  }

  if (!body.email) {
    return apiBadRequest("Email is required");
  }

  if (!validateEmail(body.email)) {
    return apiBadRequest("Invalid email format");
  }

  const normalizedName =
    typeof body.name === "string" ? body.name.trim() || null : null;

  try {
    const { rows } = await sql`
      SELECT unsubscribed_at FROM subscribers WHERE email = ${body.email}
    `;

    const existing = rows[0];

    if (existing && !existing.unsubscribed_at) {
      return apiSuccess(
        { alreadySubscribed: true },
        { message: "Already subscribed", legacyFlat: true }
      );
    }

    if (existing) {
      // Resubscribe — directly update name so an explicit null or empty string clears any previously stored name
      await sql`
        UPDATE subscribers
        SET name = ${normalizedName},
            unsubscribed_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE email = ${body.email}
      `;
    } else {
      await sql`
        INSERT INTO subscribers (email, name) VALUES (${body.email}, ${normalizedName})
      `;
    }

    // Fire-and-forget — email failure must not fail the subscription,
    // but transient failures are retried with backoff and persistent failures
    // are recorded in transactional_email_dead_letters for review (#1748).
    const subscriberEmail = body.email;
    const subscriberName = body.name ?? "";
    void executeEmailWithRetryAndDeadLetter(
      () =>
        sendWelcomeEmail(subscriberEmail, subscriberName, { maxRetries: 0 }),
      {
        emailType: "waitlist_welcome",
        recipientEmail: subscriberEmail,
        subject: "Your StreamFi Waitlist Confirmation",
        payload: { name: subscriberName },
        maxRetries: 2,
        initialBackoffMs: 250,
      }
    );

    return apiCreated(
      { alreadySubscribed: false },
      { message: "Successfully subscribed to waitlist", legacyFlat: true }
    );
  } catch (err) {
    logger.error("Waitlist subscription database error", err, {
      route: "POST /api/waitlist/subscribe",
    });
    return apiInternalError("Unable to process your subscription right now. Please try again later.");
  }
}
