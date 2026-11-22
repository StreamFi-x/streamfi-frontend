import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { validateEmail } from "../../../../utils/validators";

function tokensMatch(expected: string, provided: string): boolean {
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, providedBuf);
}

async function confirmSubscription(
  emailRaw: string | null | undefined,
  tokenRaw: string | null | undefined
) {
  if (!emailRaw || !tokenRaw) {
    return NextResponse.json(
      { error: "Email and confirmation token are required" },
      { status: 400 }
    );
  }

  const email = emailRaw.trim().toLowerCase();
  const token = tokenRaw.trim();

  if (!validateEmail(email)) {
    return NextResponse.json(
      { error: "Invalid email format" },
      { status: 400 }
    );
  }

  if (!token) {
    return NextResponse.json(
      { error: "Confirmation token is required" },
      { status: 400 }
    );
  }

  try {
    const { rows } = await sql`
      SELECT confirmation_token, confirmed_at, unsubscribed_at
      FROM subscribers
      WHERE email = ${email}
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid or expired confirmation token" },
        { status: 400 }
      );
    }

    const subscriber = rows[0] as {
      confirmation_token?: string | null;
      confirmed_at?: Date | string | null;
      unsubscribed_at?: Date | string | null;
    };

    if (
      !subscriber.confirmation_token ||
      !tokensMatch(subscriber.confirmation_token, token)
    ) {
      return NextResponse.json(
        { error: "Invalid or expired confirmation token" },
        { status: 400 }
      );
    }

    await sql`
      UPDATE subscribers
      SET confirmed_at = CURRENT_TIMESTAMP,
          confirmation_token = NULL,
          unsubscribed_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE email = ${email}
    `;

    return NextResponse.json(
      {
        success: true,
        confirmed: true,
        message: "Waitlist subscription confirmed",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[waitlist/confirm] DB error:", err);
    return NextResponse.json(
      { error: "Failed to confirm waitlist subscription" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  return confirmSubscription(
    searchParams.get("email"),
    searchParams.get("token")
  );
}

export async function POST(req: Request) {
  let body: { email?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request format" },
      { status: 400 }
    );
  }
  return confirmSubscription(body.email, body.token);
}
