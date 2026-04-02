/**
 * POST /api/wallet/onramp/order
 *
 * Called by the client (useTransak hook) after a successful Transak order event.
 * Upserts the order record in transak_orders tied to the authenticated user.
 *
 * This is a convenience path for client-initiated upserts. The authoritative
 * record update comes via the server-side webhook at /api/webhooks/transak.
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  let body: {
    id?: string;
    status?: string;
    cryptoAmount?: number | null;
    cryptoCurrency?: string;
    fiatAmount?: number;
    fiatCurrency?: string;
    walletAddress?: string;
    txHash?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    id,
    status,
    cryptoAmount,
    cryptoCurrency,
    fiatAmount,
    fiatCurrency,
    walletAddress,
    txHash,
  } = body;

  if (!id || typeof id !== "string" || id.trim() === "") {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }
  if (!status || typeof status !== "string") {
    return NextResponse.json({ error: "Missing order status" }, { status: 400 });
  }

  try {
    await sql`
      INSERT INTO transak_orders (
        id, user_id, status, crypto_amount, crypto_currency,
        fiat_amount, fiat_currency, wallet_address, tx_hash,
        created_at, updated_at
      )
      VALUES (
        ${id},
        ${session.userId},
        ${status},
        ${cryptoAmount ?? null},
        ${cryptoCurrency ?? null},
        ${fiatAmount ?? null},
        ${fiatCurrency ?? null},
        ${walletAddress ?? null},
        ${txHash ?? null},
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        status        = EXCLUDED.status,
        crypto_amount = COALESCE(EXCLUDED.crypto_amount, transak_orders.crypto_amount),
        tx_hash       = COALESCE(EXCLUDED.tx_hash,       transak_orders.tx_hash),
        updated_at    = now()
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[onramp/order] DB error:", err);
    return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
  }
}
