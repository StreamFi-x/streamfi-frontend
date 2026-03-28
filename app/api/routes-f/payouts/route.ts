import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import {
  getPayoutHistory,
  getUsdcBalance,
  notifyAdminOfPayout,
  PAYOUT_METHODS,
  sendPayoutConfirmationEmail,
} from "@/lib/routes-f/payouts";
import { toFixedAmount } from "@/lib/routes-f/format";

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const payload = await getPayoutHistory(session.userId);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[routes-f payouts GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch payout history" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const body = await req.json();
    const amountUsdc = Number.parseFloat(String(body.amount_usdc ?? 0));
    const method = String(body.method ?? "");
    const destination = String(body.destination ?? "").trim();

    if (!Number.isFinite(amountUsdc)) {
      return NextResponse.json(
        { error: "amount_usdc must be a valid number" },
        { status: 400 }
      );
    }

    if (amountUsdc < 10) {
      return NextResponse.json(
        { error: "Minimum payout is 10.00 USDC" },
        { status: 400 }
      );
    }

    if (!PAYOUT_METHODS.includes(method as (typeof PAYOUT_METHODS)[number])) {
      return NextResponse.json(
        {
          error:
            "method must be bank_transfer, stellar_wallet, or mobile_money",
        },
        { status: 400 }
      );
    }

    if (!destination) {
      return NextResponse.json(
        { error: "destination is required" },
        { status: 400 }
      );
    }

    const userResult = await sql`
      SELECT id, username, email, wallet
      FROM users
      WHERE id = ${session.userId}
      LIMIT 1
    `;

    const user = userResult.rows[0];
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const balance = await getUsdcBalance(String(user.wallet));
    if (balance < amountUsdc) {
      return NextResponse.json(
        { error: "Insufficient USDC balance" },
        { status: 400 }
      );
    }

    const feeUsdc = 0;
    const netUsdc = amountUsdc - feeUsdc;

    const payoutResult = await sql`
      INSERT INTO payouts (
        user_id,
        amount_usdc,
        method,
        destination,
        status,
        provider,
        fee_usdc,
        net_usdc
      )
      VALUES (
        ${session.userId},
        ${toFixedAmount(amountUsdc)},
        ${method}::payout_method,
        ${destination},
        'pending'::payout_status,
        'manual',
        ${toFixedAmount(feeUsdc)},
        ${toFixedAmount(netUsdc)}
      )
      RETURNING id, amount_usdc, fee_usdc, net_usdc, method, destination, status, initiated_at
    `;

    await Promise.all([
      sendPayoutConfirmationEmail({
        email: String(user.email ?? ""),
        username: user.username ? String(user.username) : null,
        amountUsdc: toFixedAmount(amountUsdc),
        method: method as (typeof PAYOUT_METHODS)[number],
        destination,
      }),
      notifyAdminOfPayout({
        username: user.username ? String(user.username) : null,
        userId: session.userId,
        amountUsdc: toFixedAmount(amountUsdc),
        method: method as (typeof PAYOUT_METHODS)[number],
        destination,
      }),
    ]);

    const payout = payoutResult.rows[0];
    return NextResponse.json(
      {
        payout: {
          id: String(payout.id),
          amount_usdc: toFixedAmount(
            Number.parseFloat(String(payout.amount_usdc))
          ),
          fee_usdc: toFixedAmount(Number.parseFloat(String(payout.fee_usdc))),
          net_usdc: toFixedAmount(Number.parseFloat(String(payout.net_usdc))),
          method: String(payout.method),
          destination: String(payout.destination),
          status: String(payout.status),
          initiated_at: new Date(String(payout.initiated_at)).toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[routes-f payouts POST]", error);
    return NextResponse.json(
      { error: "Failed to initiate payout" },
      { status: 500 }
    );
  }
}
