import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { signToken } from "@/lib/auth/sign-token";
import { createRateLimiter } from "@/lib/rate-limit";

const isRateLimited = createRateLimiter(60_000, 20); // 20 requests/min per IP

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET env var is required");
  return s;
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ── POST /api/auth/wallet-session ─────────────────────────────────────────────
// Called by auth-provider when a Freighter wallet user is confirmed in DB.
// Looks up the user, signs a short-lived JWT, and sets it as an
// HttpOnly SameSite=Strict cookie — wallet identity is now server-verified.
export async function POST(req: NextRequest) {
  if (await isRateLimited(getIp(req))) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let wallet: string;
  try {
    ({ wallet } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Stellar public keys are 56 chars, start with G, base32 alphabet
  if (!wallet || !/^G[A-Z2-7]{55}$/.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  try {
    const { rows } = await sql`
      SELECT id, wallet, username, email
      FROM users
      WHERE wallet = ${wallet}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Wallet not registered" }, { status: 404 });
    }

    const u = rows[0];
    const now = Math.floor(Date.now() / 1000);
    const token = signToken(
      { userId: u.id, wallet: u.wallet, iat: now, exp: now + COOKIE_MAX_AGE },
      getSecret()
    );

    const isProduction = process.env.NODE_ENV === "production";
    const cookieValue = [
      `wallet_session=${token}`,
      `Path=/`,
      `Max-Age=${COOKIE_MAX_AGE}`,
      `HttpOnly`,
      `SameSite=Strict`,
      isProduction ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");

    const res = NextResponse.json({ ok: true });
    res.headers.set("Set-Cookie", cookieValue);
    return res;
  } catch (err) {
    console.error("[wallet-session] DB error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── DELETE /api/auth/wallet-session ──────────────────────────────────────────
// Expires the wallet_session cookie on logout.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.headers.set(
    "Set-Cookie",
    "wallet_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict"
  );
  return res;
}
