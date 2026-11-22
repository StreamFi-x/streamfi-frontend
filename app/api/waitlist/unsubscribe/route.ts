import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { rateLimit } from "../../../../utils/rate-limit";
import { validateEmail } from "../../../../utils/validators";

const limiter = rateLimit({
  interval: 60 * 1000,
});

function tokensMatch(expected: string, provided: string): boolean {
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, providedBuf);
}

async function processUnsubscribe(
  emailRaw: string | null | undefined,
  tokenRaw: string | null | undefined
) {
  if (!emailRaw) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const email = emailRaw.trim().toLowerCase();

  if (!validateEmail(email)) {
    return NextResponse.json(
      { error: "Invalid email format" },
      { status: 400 }
    );
  }

  const token = tokenRaw?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "Unsubscribe verification token is required" },
      { status: 400 }
    );
  }

  try {
    // Use email as token for rate-limiting
    await limiter.check(
      {
        setHeader: () => {},
      },
      5,
      email
    );
  } catch {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const checkExisting = await sql`
      SELECT unsubscribe_token
      FROM subscribers
      WHERE email = ${email} AND unsubscribed_at IS NULL
    `;

    if (checkExisting.rows.length === 0) {
      return NextResponse.json(
        { error: "Email not found or already unsubscribed" },
        { status: 404 }
      );
    }

    const row = checkExisting.rows[0] as {
      unsubscribe_token?: string | null;
    };

    if (!row.unsubscribe_token || !tokensMatch(row.unsubscribe_token, token)) {
      return NextResponse.json(
        { error: "Invalid unsubscribe verification token" },
        { status: 403 }
      );
    }

    await sql`
      UPDATE subscribers
      SET unsubscribed_at = NOW(),
          confirmation_token = NULL,
          updated_at = NOW()
      WHERE email = ${email}
    `;

    return NextResponse.json(
      { message: "Successfully unsubscribed" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return NextResponse.json(
      { error: "Failed to process unsubscription" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  return processUnsubscribe(
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
  return processUnsubscribe(body.email, body.token);
}
