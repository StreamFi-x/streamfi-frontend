/**
 * POST /api/webhooks/transak
 *
 * Receives server-side order status updates from Transak.
 * Verifies the X-Transak-Signature HMAC-SHA256 header, then upserts
 * the order into transak_orders.
 *
 * Setup:
 *  1. In the Transak dashboard, set the webhook URL to:
 *       https://<your-domain>/api/webhooks/transak
 *  2. Copy the webhook secret into TRANSAK_WEBHOOK_SECRET env var.
 *
 * Signature format (Transak):
 *   X-Transak-Signature: <hex-encoded HMAC-SHA256(secret, rawBody)>
 */

import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import type { TransakWebhookPayload } from "@/types/transak";

function verifyTransakSignature(
  signature: string,
  rawBody: string,
  secret: string
): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-transak-signature");
  const webhookSecret = process.env.TRANSAK_WEBHOOK_SECRET;

  if (webhookSecret) {
    if (!signature) {
      console.error("❌ [transak webhook] Missing X-Transak-Signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    if (!verifyTransakSignature(signature, rawBody, webhookSecret)) {
      console.error("❌ [transak webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    console.warn(
      "⚠️  TRANSAK_WEBHOOK_SECRET not set — skipping signature verification (set it in production)"
    );
  }

  let payload: TransakWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const order = payload?.webhookData;
  if (!order?.id || !order?.status) {
    console.error(
      "❌ [transak webhook] Missing order data in payload",
      payload
    );
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  console.log(`🔔 Transak webhook: order ${order.id} → ${order.status}`);

  try {
    // Resolve the StreamFi user by wallet address so we can associate the order.
    // wallet_address is the Stellar public key the user provided to Transak.
    const userResult = await sql`
      SELECT id FROM users WHERE wallet = ${order.walletAddress} LIMIT 1
    `;
    const userId: string | null =
      userResult.rows.length > 0 ? userResult.rows[0].id : null;

    await sql`
      INSERT INTO transak_orders (
        id, user_id, status, crypto_amount, crypto_currency,
        fiat_amount, fiat_currency, wallet_address, tx_hash,
        created_at, updated_at
      )
      VALUES (
        ${order.id},
        ${userId},
        ${order.status},
        ${order.cryptoAmount ?? null},
        ${order.cryptoCurrency ?? null},
        ${order.fiatAmount ?? null},
        ${order.fiatCurrency ?? null},
        ${order.walletAddress ?? null},
        ${order.transactionHash ?? null},
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        status        = EXCLUDED.status,
        crypto_amount = COALESCE(EXCLUDED.crypto_amount, transak_orders.crypto_amount),
        tx_hash       = COALESCE(EXCLUDED.tx_hash,       transak_orders.tx_hash),
        updated_at    = now()
    `;

    console.log(`✅ [transak webhook] Upserted order ${order.id}`);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("❌ [transak webhook] DB error:", err);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Transak webhook endpoint is active",
  });
}
