/**
 * Server-side session verification utility.
 *
 * Usage in any API route:
 *
 *   const session = await verifySession(req);
 *   if (!session.ok) return session.response; // 401
 *   const { userId, wallet, privyId } = session;
 *
 * Security model:
 * - Privy users: `privy_session` HttpOnly cookie contains the server-verified
 *   Privy user ID (did:privy:xxx). Set by /api/auth/session after JWT verification.
 * - Wallet users (new): `wallet_session` HttpOnly cookie contains an HMAC-SHA256
 *   signed JWT with { userId, wallet, exp }. Set by /api/auth/wallet-session.
 * - Wallet users (legacy): raw `wallet` cookie — accepted as fallback while
 *   existing sessions expire (max 24h). Remove this path once all clients
 *   have re-authenticated with the new signed cookie.
 *
 * Uses req.cookies (Next.js built-in) instead of manual header parsing.
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyToken } from "@/lib/auth/sign-token";

export type VerifiedSession =
  | {
      ok: true;
      userId: string;
      wallet: string | null;
      privyId: string | null;
      username: string | null;
      email: string | null;
    }
  | { ok: false; response: NextResponse };

function getSessionSecret(): string | null {
  return process.env.SESSION_SECRET ?? null;
}

export async function verifySession(
  req: NextRequest
): Promise<VerifiedSession> {
  const privySessionId = req.cookies.get("privy_session")?.value;
  const walletSessionToken = req.cookies.get("wallet_session")?.value;
  const legacyWalletCookie = req.cookies.get("wallet")?.value;

  // ── Privy session (preferred — server-verified) ──────────────────────────
  if (privySessionId) {
    if (!privySessionId.startsWith("did:privy:")) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Invalid session" },
          { status: 401 }
        ),
      };
    }

    try {
      const { rows } = await sql`
        SELECT id, privy_id, wallet, username, email
        FROM users
        WHERE privy_id = ${privySessionId}
        LIMIT 1
      `;

      if (rows.length === 0) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Session not found" },
            { status: 401 }
          ),
        };
      }

      const u = rows[0];
      return {
        ok: true,
        userId: u.id,
        wallet: u.wallet ?? null,
        privyId: u.privy_id,
        username: u.username ?? null,
        email: u.email ?? null,
      };
    } catch {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Session verification failed" },
          { status: 500 }
        ),
      };
    }
  }

  // ── Signed wallet session (new — HMAC-verified) ──────────────────────────
  if (walletSessionToken) {
    const secret = getSessionSecret();
    if (!secret) {
      console.error(
        "[verifySession] SESSION_SECRET not configured — wallet_session cannot be verified"
      );
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Server misconfiguration" },
          { status: 500 }
        ),
      };
    }

    const payload = verifyToken<{ userId: string; wallet: string }>(
      walletSessionToken,
      secret
    );
    if (!payload) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Invalid or expired session" },
          { status: 401 }
        ),
      };
    }

    try {
      // Cross-check both userId AND wallet against DB — forged tokens with
      // valid signatures but mismatched fields are rejected here.
      const { rows } = await sql`
        SELECT id, wallet, username, email, privy_id
        FROM users
        WHERE id = ${payload.userId} AND wallet = ${payload.wallet}
        LIMIT 1
      `;

      if (rows.length === 0) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Session not found" },
            { status: 401 }
          ),
        };
      }

      const u = rows[0];
      return {
        ok: true,
        userId: u.id,
        wallet: u.wallet,
        privyId: u.privy_id ?? null,
        username: u.username ?? null,
        email: u.email ?? null,
      };
    } catch {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Session verification failed" },
          { status: 500 }
        ),
      };
    }
  }

  // ── Legacy raw wallet cookie (fallback — remove after migration) ──────────
  // Accepted while existing Freighter sessions (set before the wallet_session
  // upgrade) are still live. They expire within 24h of the deployment.
  if (legacyWalletCookie) {
    if (!/^G[A-Z2-7]{55}$/.test(legacyWalletCookie)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Invalid wallet session" },
          { status: 401 }
        ),
      };
    }

    try {
      const { rows } = await sql`
        SELECT id, wallet, username, email, privy_id
        FROM users
        WHERE wallet = ${legacyWalletCookie}
        LIMIT 1
      `;

      if (rows.length === 0) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Wallet not registered" },
            { status: 401 }
          ),
        };
      }

      const u = rows[0];
      return {
        ok: true,
        userId: u.id,
        wallet: u.wallet,
        privyId: u.privy_id ?? null,
        username: u.username ?? null,
        email: u.email ?? null,
      };
    } catch {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Session verification failed" },
          { status: 500 }
        ),
      };
    }
  }

  // No valid session found
  return {
    ok: false,
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}

/**
 * Ownership guard: call after verifySession to ensure the authenticated user
 * owns the resource they're trying to mutate.
 *
 * Usage:
 *   assertOwnership(session, targetWallet)       // wallet-keyed resources
 *   assertOwnership(session, null, targetUserId) // ID-keyed resources
 */
export function assertOwnership(
  session: Extract<VerifiedSession, { ok: true }>,
  targetWallet: string | null,
  targetUserId?: string
): NextResponse | null {
  if (targetUserId && session.userId !== targetUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (targetWallet && session.wallet !== targetWallet) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null; // authorized
}
