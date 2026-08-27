/**
 * POST /api/routes-f/auth-magic-link-consume
 *
 * Accepts the signed token from a magic-link email and, if valid and unused,
 * logs the user in by issuing a `wallet_session` cookie — the same session
 * format verifySession() already accepts, so every other authenticated route
 * works immediately with no changes.
 *
 * Security notes:
 *  - The token is checked in three independent ways: HMAC signature +
 *    embedded expiry (verifyToken), and a DB row that must exist, be
 *    unconsumed, and unexpired. All three must agree.
 *  - Consuming the token (marking consumed_at) happens in the same UPDATE
 *    that looks it up (`WHERE consumed_at IS NULL ... RETURNING`), so two
 *    concurrent requests replaying the same link can't both succeed — only
 *    one UPDATE will affect a row.
 *  - Every account has a NOT NULL wallet (see db/schema.sql), so reusing the
 *    wallet_session token shape (userId + wallet) is safe even for accounts
 *    that signed up with email only.
 *  - Rate limited per-IP to blunt brute-forcing the token value itself.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { verifyToken, signToken } from "@/lib/auth/sign-token";
import { hashToken, createSession } from "@/lib/sessions/user-sessions";
import { createRateLimiter } from "@/lib/rate-limit";

// 10 attempts per 15 minutes per IP — the token itself is a 128-bit signed
// value (guess-resistant), this just keeps automated brute force off the table.
const isRateLimited = createRateLimiter(15 * 60 * 1000, 10);

const WALLET_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days, matches a normal login session

const consumeSchema = z.object({
  token: z.string().min(1, "token is required"),
});

interface MagicLinkPayload {
  userId: string;
  purpose: string;
  nonce: string;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": "900" } }
    );
  }

  let body: z.infer<typeof consumeSchema>;
  try {
    const raw = await request.json();
    const parsed = consumeSchema.safeParse(raw);
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

  const { token } = body;

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error(
      "[routes-f auth-magic-link-consume] SESSION_SECRET not configured"
    );
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  // 1. Verify the magic-link token's signature and embedded expiry.
  const payload = verifyToken<MagicLinkPayload>(token, secret);
  if (!payload || payload.purpose !== "magic_link" || !payload.userId) {
    return NextResponse.json(
      { error: "Invalid or expired sign-in link" },
      { status: 400 }
    );
  }

  const tokenHash = hashToken(token);

  try {
    // 2. Atomically look up + consume the token row. A replayed link (same
    //    token used twice, or a race between two concurrent requests) finds
    //    zero rows on the second attempt.
    const { rows: consumedRows } = await sql`
      UPDATE magic_link_tokens
      SET consumed_at = NOW()
      WHERE token_hash = ${tokenHash}
        AND user_id = ${payload.userId}
        AND consumed_at IS NULL
        AND expires_at > NOW()
      RETURNING user_id
    `;

    if (consumedRows.length === 0) {
      return NextResponse.json(
        { error: "Invalid, expired, or already-used sign-in link" },
        { status: 400 }
      );
    }

    const userId = consumedRows[0].user_id;

    const { rows: userRows } = await sql`
      SELECT id, wallet FROM users WHERE id = ${userId} LIMIT 1
    `;

    if (userRows.length === 0) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const user = userRows[0];

    // 3. Issue a session in the same shape verifySession() already accepts
    //    for wallet users, so downstream routes need no changes.
    const sessionToken = signToken({ userId: user.id, wallet: user.wallet }, secret);

    await createSession({
      userId: user.id,
      rawToken: sessionToken,
      ipAddress: ip === "unknown" ? null : ip,
      userAgent: request.headers.get("user-agent"),
      ttlSeconds: WALLET_SESSION_TTL_SECONDS,
    });

    const response = NextResponse.json(
      { message: "Signed in successfully." },
      { status: 200 }
    );

    response.cookies.set("wallet_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: WALLET_SESSION_TTL_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("[routes-f auth-magic-link-consume POST]", error);
    return NextResponse.json(
      { error: "Failed to sign in" },
      { status: 500 }
    );
  }
}
