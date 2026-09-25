/**
 * GET  /api/routes-f/payouts  — payout history for the signed-in creator
 * POST /api/routes-f/payouts  — request a (manual) USDC payout
 *
 * POST requires an `Idempotency-Key` header. Retries with the same key replay
 * the original response and never create a second payout; every payout row
 * stores the idempotency record that created it (payouts.idempotency_ref), so
 * a retry that takes over a crashed attempt recovers the original payout.
 * Payouts are fulfilled manually (provider = 'manual'); there is no external
 * payment provider call to deduplicate. See docs/idempotency.md.
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import {
  executeIdempotent,
  IDEMPOTENT_OPERATIONS,
} from "@/lib/idempotency/execute";
import {
  getPayoutHistory,
  getUsdcBalance,
  notifyAdminOfPayout,
  PAYOUT_METHODS,
  PayoutMethod,
  sendPayoutConfirmationEmail,
} from "@/lib/routes-f/payouts";
import { toFixedAmount } from "@/lib/routes-f/format";

const PAYOUT_COLUMNS =
  "id, amount_usdc, fee_usdc, net_usdc, method, destination, status, initiated_at";

function payoutResponse(payout: Record<string, unknown>): NextResponse {
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
}

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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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
  if (!PAYOUT_METHODS.includes(method as PayoutMethod)) {
    return NextResponse.json(
      {
        error: "method must be bank_transfer, stellar_wallet, or mobile_money",
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

  const request = {
    amount_usdc: toFixedAmount(amountUsdc),
    method,
    destination,
  };

  return executeIdempotent(
    req,
    {
      userId: session.userId,
      ...IDEMPOTENT_OPERATIONS.payoutCreate,
      request,
    },
    async ({ idempotencyRef, recovered }) => {
      try {
        if (recovered) {
          const existing = await sql.query(
            `SELECT ${PAYOUT_COLUMNS} FROM payouts WHERE idempotency_ref = $1`,
            [idempotencyRef]
          );
          if (existing.rows[0]) {
            return payoutResponse(existing.rows[0]);
          }
        }

        const userResult = await sql`
          SELECT id, username, email, wallet
          FROM users
          WHERE id = ${session.userId}
          LIMIT 1
        `;
        const user = userResult.rows[0];
        if (!user) {
          return NextResponse.json(
            { error: "User not found" },
            { status: 404 }
          );
        }

        // Funds already requested but not yet paid out are not available.
        const [balance, pendingResult] = await Promise.all([
          getUsdcBalance(String(user.wallet)),
          sql`
            SELECT COALESCE(SUM(amount_usdc), 0) AS pending
            FROM payouts
            WHERE user_id = ${session.userId}
              AND status IN ('pending', 'processing')
          `,
        ]);
        const pending = Number.parseFloat(
          String(pendingResult.rows[0]?.pending ?? 0)
        );
        if (balance - pending < amountUsdc) {
          return NextResponse.json(
            { error: "Insufficient USDC balance" },
            { status: 400 }
          );
        }

        const feeUsdc = 0;
        const netUsdc = amountUsdc - feeUsdc;

        const inserted = await sql.query(
          `INSERT INTO payouts (
             user_id, amount_usdc, method, destination, status, provider,
             fee_usdc, net_usdc, idempotency_ref
           )
           VALUES ($1, $2, $3::payout_method, $4, 'pending'::payout_status,
                   'manual', $5, $6, $7)
           ON CONFLICT (idempotency_ref) WHERE idempotency_ref IS NOT NULL
           DO NOTHING
           RETURNING ${PAYOUT_COLUMNS}`,
          [
            session.userId,
            toFixedAmount(amountUsdc),
            method,
            destination,
            toFixedAmount(feeUsdc),
            toFixedAmount(netUsdc),
            idempotencyRef,
          ]
        );

        if (!inserted.rows[0]) {
          const existing = await sql.query(
            `SELECT ${PAYOUT_COLUMNS} FROM payouts WHERE idempotency_ref = $1`,
            [idempotencyRef]
          );
          return payoutResponse(existing.rows[0]);
        }

        // Notifications must not turn a recorded payout into an error the
        // client would retry.
        const notifications = await Promise.allSettled([
          sendPayoutConfirmationEmail({
            email: String(user.email ?? ""),
            username: user.username ? String(user.username) : null,
            amountUsdc: toFixedAmount(amountUsdc),
            method: method as PayoutMethod,
            destination,
          }),
          notifyAdminOfPayout({
            username: user.username ? String(user.username) : null,
            userId: session.userId,
            amountUsdc: toFixedAmount(amountUsdc),
            method: method as PayoutMethod,
            destination,
          }),
        ]);
        for (const result of notifications) {
          if (result.status === "rejected") {
            console.error(
              "[routes-f payouts POST] notification failed",
              result.reason
            );
          }
        }

        return payoutResponse(inserted.rows[0]);
      } catch (error) {
        console.error("[routes-f payouts POST]", error);
        return NextResponse.json(
          { error: "Failed to initiate payout" },
          { status: 500 }
        );
      }
    }
  );
}
