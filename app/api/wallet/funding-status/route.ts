import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { cacheHeaders } from "@/lib/cache";
import {
  CircuitOpenError,
  DownstreamTimeoutError,
} from "@/lib/resilience/circuit-breaker";
import { getNativeBalance, STELLAR_ADDRESS } from "@/lib/stellar/balance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/wallet/funding-status (#1424)
 *
 * The signed-in user's wallet funding state, which drives the first-time
 * funding onboarding (components/wallet/funding).
 *
 * - walletType "custodial": StreamFi holds the wallet's key
 *   (users.encrypted_stellar_key, created at sign-up by
 *   /api/auth/onboarding). "external": a wallet the user connected and
 *   funds themselves. "none": no wallet yet.
 * - activated: the account exists on the Stellar ledger. A new custodial
 *   wallet is a fresh keypair that does not exist on the ledger until it
 *   first receives XLM, so "custodial and not activated" is exactly "a
 *   custodial wallet that has never been funded". A wallet that was funded
 *   and later spent down is activated, so its owner is never treated as a
 *   first-time user.
 * - eligible: custodial and never funded.
 *
 * Horizon unavailable: 503, so the client shows nothing rather than guess.
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { rows } = await sql`
    SELECT wallet, encrypted_stellar_key IS NOT NULL AS custodial
      FROM users WHERE id = ${session.userId} AND deleted_at IS NULL
  `;
  const user = rows[0];
  const address =
    typeof user?.wallet === "string" && STELLAR_ADDRESS.test(user.wallet)
      ? user.wallet
      : null;

  const headers = cacheHeaders("privateNoStore");
  if (!address) {
    return NextResponse.json(
      { walletType: "none", address: null, eligible: false },
      { headers }
    );
  }
  if (!user.custodial) {
    return NextResponse.json(
      { walletType: "external", address, eligible: false },
      { headers }
    );
  }

  try {
    const { balance, activated } = await getNativeBalance(address);
    return NextResponse.json(
      {
        walletType: "custodial",
        address,
        activated,
        balance,
        eligible: !activated,
      },
      { headers }
    );
  } catch (error) {
    if (
      error instanceof CircuitOpenError ||
      error instanceof DownstreamTimeoutError
    ) {
      return NextResponse.json(
        { error: "The Stellar network is not responding" },
        { status: 503, headers: { ...headers, "Retry-After": "15" } }
      );
    }
    console.error("[wallet/funding-status] balance lookup failed:", error);
    return NextResponse.json(
      { error: "Failed to load wallet status" },
      { status: 502, headers }
    );
  }
}
