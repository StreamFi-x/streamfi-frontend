import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export async function ensureCreditsSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_vouchers (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code             TEXT UNIQUE NOT NULL,
      amount_usd       NUMERIC(10,2) NOT NULL,
      max_redemptions  INT NOT NULL DEFAULT 1,
      redemption_count INT NOT NULL DEFAULT 0,
      expires_at       TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS route_f_credits (
      user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      balance_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
      expires_at  TIMESTAMPTZ,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS route_f_voucher_redemptions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      voucher_id  UUID NOT NULL REFERENCES route_f_vouchers(id) ON DELETE CASCADE,
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (voucher_id, user_id)
    )
  `;
}

/**
 * GET /api/routes-f/credits
 * Returns the authenticated user's credit balance and expiry.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  try {
    await ensureCreditsSchema();

    const { rows } = await sql`
      SELECT balance_usd, expires_at, updated_at
      FROM route_f_credits
      WHERE user_id = ${session.userId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ balance_usd: "0.00", expires_at: null });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("[routes-f credits GET]", error);
    return NextResponse.json({ error: "Failed to fetch credits" }, { status: 500 });
  }
}
