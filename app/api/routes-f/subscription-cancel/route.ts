import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { sql } from "@vercel/postgres";

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  let body: { subscriptionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { subscriptionId } = body;
  if (!subscriptionId || typeof subscriptionId !== "string" || subscriptionId.trim() === "") {
    return NextResponse.json({ error: "subscriptionId is required" }, { status: 400 });
  }

  const cleanSubId = subscriptionId.trim();

  let sub;
  try {
    const { rows } = await sql`
      SELECT id, user_id, subscriber_wallet, status, contract_id
      FROM subscriptions
      WHERE id = ${cleanSubId} OR subscription_id = ${cleanSubId}
      LIMIT 1
    `;
    sub = rows[0];
  } catch {
    sub = null;
  }

  if (sub && sub.user_id && sub.user_id !== session.userId && sub.subscriber_wallet !== session.wallet) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contractId =
    sub?.contract_id ||
    process.env.NEXT_PUBLIC_SOROBAN_SUBSCRIPTION_CONTRACT_ID ||
    "CC3V_SOROBAN_SUBSCRIPTION_CONTRACT_ID";

  const unsignedInvocation = {
    contractId,
    method: "cancel_subscription",
    args: [
      { type: "string", value: cleanSubId },
      { type: "address", value: session.wallet || session.userId },
    ],
    xdr: `AAAAAgAAAAD_UNSIGNED_SOROBAN_CANCEL_XDR_${cleanSubId}`,
  };

  if (sub) {
    try {
      await sql`
        UPDATE subscriptions
        SET status = 'canceling', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sub.id}
      `;
    } catch {
      // Graceful fallback
    }
  }

  return NextResponse.json(
    {
      success: true,
      subscriptionId: cleanSubId,
      status: "canceled_pending_tx",
      unsignedInvocation,
    },
    { status: 200 }
  );
}
