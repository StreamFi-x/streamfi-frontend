import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { validateEmail } from "../../../../utils/validators";
import { sendWelcomeEmail } from "../../../../utils/send-email";
import {
  apiBadRequest,
  apiCreated,
  apiInternalError,
  apiSuccess,
} from "@/lib/api";

export async function POST(req: NextRequest) {
  let body: { email?: string; name?: string };
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

    // Fire-and-forget — email failure must not fail the subscription
    sendWelcomeEmail(body.email, body.name ?? "").catch(err =>
      // eslint-disable-next-line no-console
      console.error("[waitlist] Failed to send welcome email:", err)
    );

    return apiCreated(
      { alreadySubscribed: false },
      { message: "Successfully subscribed to waitlist", legacyFlat: true }
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[waitlist] DB error:", err);
    return apiInternalError("Database operation failed");
  }
}
