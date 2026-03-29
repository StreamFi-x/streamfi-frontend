import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { ensureCreditsSchema } from "../route";

const redeemSchema = z.object({
  code: z.string().trim().min(1).max(100),
});

/**
 * POST /api/routes-f/credits/redeem
 * Redeem a voucher code to add credits to the authenticated user's balance.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const bodyResult = await validateBody(req, redeemSchema);
  if (bodyResult instanceof Response) return bodyResult;

  const { code } = bodyResult.data;

  try {
    await ensureCreditsSchema();

    // 1. Look up voucher
    const { rows: voucherRows } = await sql`
      SELECT id, amount_usd, max_redemptions, redemption_count, expires_at
      FROM route_f_vouchers
      WHERE UPPER(code) = UPPER(${code})
      LIMIT 1
    `;

    if (voucherRows.length === 0) {
      return NextResponse.json({ error: "Invalid voucher code" }, { status: 404 });
    }

    const voucher = voucherRows[0];

    // 2. Check expiry
    if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
      return NextResponse.json({ error: "Voucher has expired" }, { status: 410 });
    }

    // 3. Check redemption limit
    if (voucher.redemption_count >= voucher.max_redemptions) {
      return NextResponse.json({ error: "Voucher has reached its redemption limit" }, { status: 409 });
    }

    // 4. Check if user already redeemed this voucher
    const { rows: alreadyRedeemed } = await sql`
      SELECT 1 FROM route_f_voucher_redemptions
      WHERE voucher_id = ${voucher.id} AND user_id = ${session.userId}
      LIMIT 1
    `;

    if (alreadyRedeemed.length > 0) {
      return NextResponse.json({ error: "You have already redeemed this voucher" }, { status: 409 });
    }

    // 5. Record redemption, increment counter, and credit user — all in one transaction
    await sql`
      INSERT INTO route_f_voucher_redemptions (voucher_id, user_id)
      VALUES (${voucher.id}, ${session.userId})
    `;

    await sql`
      UPDATE route_f_vouchers
      SET redemption_count = redemption_count + 1
      WHERE id = ${voucher.id}
    `;

    const { rows: creditRows } = await sql`
      INSERT INTO route_f_credits (user_id, balance_usd, expires_at, updated_at)
      VALUES (${session.userId}, ${voucher.amount_usd}, ${voucher.expires_at ?? null}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        balance_usd = route_f_credits.balance_usd + EXCLUDED.balance_usd,
        expires_at  = GREATEST(route_f_credits.expires_at, EXCLUDED.expires_at),
        updated_at  = NOW()
      RETURNING balance_usd, expires_at
    `;

    return NextResponse.json({
      success: true,
      credited_usd: voucher.amount_usd,
      new_balance_usd: creditRows[0].balance_usd,
      expires_at: creditRows[0].expires_at,
    });
  } catch (error) {
    console.error("[routes-f credits/redeem POST]", error);
    return NextResponse.json({ error: "Failed to redeem voucher" }, { status: 500 });
  }
}
