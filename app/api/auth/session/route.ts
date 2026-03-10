import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";

// 10 Privy session exchanges per IP per 60 s
const isRateLimited = createRateLimiter(60_000, 10);

// ─── Privy server client (lazy-initialised once) ──────────────────────────────
let _privy: PrivyClient | null = null;
function getPrivy(): PrivyClient {
  if (!_privy) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const secret = process.env.PRIVY_APP_SECRET;
    if (!appId || !secret) {
      throw new Error(
        "Privy env vars missing: NEXT_PUBLIC_PRIVY_APP_ID / PRIVY_APP_SECRET"
      );
    }
    _privy = new PrivyClient(appId, secret);
  }
  return _privy;
}

// ─── POST /api/auth/session ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Rate limit by IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // 2. Extract and verify Privy token — NEVER trust client-supplied user data
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing authorization header" },
      { status: 401 }
    );
  }
  const token = authHeader.slice(7);

  let claims: Awaited<ReturnType<PrivyClient["verifyAuthToken"]>>;
  try {
    claims = await getPrivy().verifyAuthToken(token);
  } catch {
    // Don't leak internal error details — just signal invalid token
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }

  const privyUserId = claims.userId; // "did:privy:xxx" — server-verified

  // 3. Fetch full Privy user to get the verified Google email
  let privyUser: Awaited<ReturnType<PrivyClient["getUser"]>>;
  try {
    privyUser = await getPrivy().getUser(privyUserId);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch user from Privy" },
      { status: 502 }
    );
  }

  const googleAccount = privyUser.linkedAccounts?.find(
    (a: { type: string }) => a.type === "google_oauth"
  ) as { type: "google_oauth"; email?: string; name?: string } | undefined;

  const verifiedEmail = googleAccount?.email ?? null;
  const displayName = googleAccount?.name ?? null;

  // 4. Upsert user in DB — use privy_id as the identity anchor
  try {
    // Guard: if this email is already claimed by a wallet-registered user, block
    // the Privy login so the same email can't be used for two separate accounts.
    if (verifiedEmail) {
      const { rows: emailConflict } = await sql`
        SELECT id FROM users
        WHERE LOWER(email) = LOWER(${verifiedEmail})
          AND wallet IS NOT NULL
          AND (privy_id IS NULL OR privy_id != ${privyUserId})
        LIMIT 1
      `;
      if (emailConflict.length > 0) {
        return NextResponse.json(
          {
            error:
              "This email is already associated with a wallet account. Please sign in with your wallet instead.",
          },
          { status: 409 }
        );
      }
    }

    // Insert if new, do nothing if existing (idempotent)
    await sql`
      INSERT INTO users (privy_id, email, avatar)
      VALUES (${privyUserId}, ${verifiedEmail}, '/Images/user.png')
      ON CONFLICT (privy_id) DO NOTHING
    `;

    // Fetch current user record
    const { rows } = await sql`
      SELECT id, privy_id, username, email, avatar, wallet
      FROM users
      WHERE privy_id = ${privyUserId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "User record not found after upsert" },
        { status: 500 }
      );
    }

    const dbUser = rows[0];
    const needsOnboarding = !dbUser.username;

    // 5. Build secure session cookie — HttpOnly, Secure, SameSite=Strict
    //    We store the privy_id (opaque, server-verified) — never the raw JWT
    const isProduction = process.env.NODE_ENV === "production";
    const cookieMaxAge = 24 * 60 * 60; // 24 h in seconds
    const cookieValue = [
      `privy_session=${privyUserId}`,
      `Path=/`,
      `Max-Age=${cookieMaxAge}`,
      `HttpOnly`,
      `SameSite=Strict`,
      isProduction ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");

    const res = NextResponse.json({
      ok: true,
      needsOnboarding,
      user: {
        id: dbUser.id,
        privyId: dbUser.privy_id,
        username: dbUser.username ?? null,
        email: dbUser.email ?? verifiedEmail,
        avatar: dbUser.avatar ?? null,
        wallet: dbUser.wallet ?? null,
        displayName,
      },
    });

    res.headers.set("Set-Cookie", cookieValue);
    return res;
  } catch (err) {
    console.error("[session] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/auth/session  (logout) ───────────────────────────────────────
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  // Expire the cookie immediately
  res.headers.set(
    "Set-Cookie",
    "privy_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict"
  );
  return res;
}
