import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { validateEmail } from "../../../../utils/validators";
import { sendWelcomeEmail } from "../../../../utils/send-email";

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function POST(req: NextRequest) {
  let body: { email?: string; name?: string | null };
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

  const email = body.email.trim().toLowerCase();

  if (!validateEmail(email)) {
    return NextResponse.json(
      { error: "Invalid email format" },
      { status: 400 }
    );
  }

  const normalizedName =
    typeof body.name === "string" ? body.name.trim() || null : null;

  try {
    const { rows } = await sql`
      SELECT confirmed_at, unsubscribed_at, unsubscribe_token
      FROM subscribers
      WHERE email = ${email}
    `;

    const existing = rows[0] as
      | {
          confirmed_at?: Date | string | null;
          unsubscribed_at?: Date | string | null;
          unsubscribe_token?: string | null;
        }
      | undefined;

    if (existing && existing.confirmed_at && !existing.unsubscribed_at) {
      return NextResponse.json({
        message: "Already subscribed",
        alreadySubscribed: true,
      });
    }

    const confirmationToken = generateToken();
    const unsubscribeToken =
      existing?.unsubscribe_token && !existing.unsubscribed_at
        ? existing.unsubscribe_token
        : generateToken();

    if (existing) {
      // Pending verification or resubscribing after unsubscribe — require double opt-in confirmation.
      // An explicit null or empty name clears any previously stored name.
      await sql`
        UPDATE subscribers
        SET name = ${normalizedName},
            confirmation_token = ${confirmationToken},
            confirmed_at = NULL,
            unsubscribe_token = ${unsubscribeToken},
            unsubscribed_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE email = ${email}
      `;
    } else {
      await sql`
        INSERT INTO subscribers (
          email,
          name,
          confirmation_token,
          confirmed_at,
          unsubscribe_token
        )
        VALUES (
          ${email},
          ${normalizedName},
          ${confirmationToken},
          NULL,
          ${unsubscribeToken}
        )
      `;
    }

    // Fire-and-forget — email failure must not fail the subscription request
    sendWelcomeEmail(email, normalizedName ?? "", {
      confirmationToken,
      unsubscribeToken,
    }).catch(err =>
      console.error("[waitlist] Failed to send confirmation email:", err)
    );

    return NextResponse.json(
      {
        success: true,
        pendingConfirmation: true,
        message:
          "Please check your email to confirm your waitlist subscription",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[waitlist] DB error:", err);
    return NextResponse.json(
      { error: "Database operation failed" },
      { status: 500 }
    );
  }
}
