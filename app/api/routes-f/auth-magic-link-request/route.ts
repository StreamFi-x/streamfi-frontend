/**
 * POST /api/routes-f/auth-magic-link-request
 *
 * Sends a one-time sign-in link to a verified account email. This is the
 * "request" half of the magic-link login flow — the returned link's token
 * is later exchanged for a session by POST /api/routes-f/auth-magic-link-consume,
 * which already reads the same `magic_link_tokens` table this route writes to.
 *
 * Unlike the 2FA routes above, this endpoint is intentionally pre-auth /
 * public: it's how a user without an active session signs in.
 *
 * Modeled directly on auth-password-reset-request:
 *  - Always responds with the same generic 200 message, whether or not the
 *    email is registered (and whether or not it's verified), so the
 *    endpoint can't be used to enumerate accounts or their verification
 *    state.
 *  - Rate limited per-IP and per-account (normalized email) independently,
 *    so neither a single attacker IP nor a distributed one can flood one
 *    victim's inbox, and one attacker can't cheaply probe many addresses
 *    from one IP.
 *  - Only a signed, single-use, short-lived token's SHA-256 hash is
 *    persisted — the raw token only ever appears in the emailed link.
 *
 * Requires a verified email (`"emailVerified" = true`) before sending,
 * since a magic link is a full login bypass — sending it to an unverified
 * address would let anyone who merely typed in someone else's email log
 * into that account.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { randomBytes } from "crypto";
import { signToken } from "@/lib/auth/sign-token";
import { hashToken } from "@/lib/sessions/user-sessions";
import { createRateLimiter } from "@/lib/rate-limit";
import { sendMagicLinkEmail } from "@/utils/send-email";

// 5 requests per 15 minutes per IP, and independently per account — same
// budget as auth-password-reset-request. Generous for a legitimate user
// retrying a missed email, tight enough to blunt inbox-flooding.
const isIpRateLimited = createRateLimiter(15 * 60 * 1000, 5);
const isAccountRateLimited = createRateLimiter(15 * 60 * 1000, 5);

const MAGIC_LINK_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes — a login link should be short-lived

const requestSchema = z.object({
  email: z.string().trim().email("A valid email is required"),
});

const GENERIC_RESPONSE = {
  message:
    "If a verified account with that email exists, a sign-in link has been sent.",
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

  // Per-account limiting keyed on the normalized email — independent of IP
  // so a distributed attacker still can't hammer one victim's inbox.
  if (await isAccountRateLimited(email)) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": "900" } }
    );
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error(
      "[routes-f auth-magic-link-request] SESSION_SECRET not configured"
    );
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  try {
    const { rows } = await sql`
      SELECT id, email FROM users
      WHERE lower(email) = ${email} AND "emailVerified" = true
      LIMIT 1
    `;

    // Do not reveal whether the account exists or is verified — always
    // return the same generic success response.
    if (rows.length === 0) {
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    const user = rows[0];

    const nonce = randomBytes(16).toString("hex");
    const exp = Math.floor(Date.now() / 1000) + MAGIC_LINK_TOKEN_TTL_SECONDS;
    const rawToken = signToken(
      { userId: user.id, purpose: "magic_link", nonce, exp },
      secret
    );
    const tokenHash = hashToken(rawToken);

    // Invalidate any previously issued, still-unused magic links for this
    // user before storing the new one — only the most recently requested
    // link works, matching auth-magic-link-consume's single-use guarantee.
    await sql`
      UPDATE magic_link_tokens
      SET consumed_at = NOW()
      WHERE user_id = ${user.id} AND consumed_at IS NULL
    `;

    await sql`
      INSERT INTO magic_link_tokens (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${tokenHash}, NOW() + INTERVAL '15 minutes')
    `;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const magicLinkUrl = `${baseUrl}/login/magic?token=${encodeURIComponent(rawToken)}`;

    await sendMagicLinkEmail(user.email, magicLinkUrl).catch((err: unknown) => {
      // Do not fail the request just because the email provider hiccuped —
      // log it, but keep the response generic either way.
      console.error(
        "[routes-f auth-magic-link-request] Failed to send email:",
        err
      );
    });

    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  } catch (error) {
    console.error("[routes-f auth-magic-link-request POST]", error);
    return NextResponse.json(
      { error: "Failed to process sign-in link request" },
      { status: 500 }
    );
  }
}
