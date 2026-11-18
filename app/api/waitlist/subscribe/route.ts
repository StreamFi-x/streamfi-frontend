import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { validateEmail } from "../../../../utils/validators";
import { sendWelcomeEmail } from "../../../../utils/send-email";
import { executeEmailWithRetryAndDeadLetter } from "@/lib/email/reliable-sender";
import { logger } from "@/lib/tracing/logger";

export async function POST(req: NextRequest) {
  let body: { email?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request format" },
      { status: 400 }
    );
  }

  if (!body.email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!validateEmail(body.email)) {
    return NextResponse.json(
      { error: "Invalid email format" },
      { status: 400 }
    );
  }

  try {
    const { rows } = await sql`
      SELECT unsubscribed_at FROM subscribers WHERE email = ${body.email}
    `;

    const existing = rows[0];

    if (existing && !existing.unsubscribed_at) {
      return NextResponse.json({
        message: "Already subscribed",
        alreadySubscribed: true,
      });
    }

    if (existing) {
      // Resubscribe
      await sql`
        UPDATE subscribers
        SET name = COALESCE(${body.name ?? null}, name),
            unsubscribed_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE email = ${body.email}
      `;
    } else {
      await sql`
        INSERT INTO subscribers (email, name) VALUES (${body.email}, ${body.name ?? null})
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

    return NextResponse.json(
      { success: true, message: "Successfully subscribed to waitlist" },
      { status: 201 }
    );
  } catch (err) {
    logger.error("Waitlist subscription database error", err, {
      route: "POST /api/waitlist/subscribe",
    });
    return NextResponse.json(
      { error: "Database operation failed" },
      { status: 500 }
    );
  }
}
