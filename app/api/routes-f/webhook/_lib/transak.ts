import { createHmac, timingSafeEqual } from "crypto";
import { sql } from "@vercel/postgres";

// ────────────────────────────────────────────────────────────────
// Transak webhook handler
// ────────────────────────────────────────────────────────────────

/**
 * Verify Transak webhook signature using HMAC-SHA256.
 */
export function verifyTransakSignature(
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

interface TransakOrderData {
  id: string;
  status: string;
  cryptoAmount?: number;
  cryptoCurrency?: string;
  fiatAmount?: number;
  fiatCurrency?: string;
  walletAddress?: string;
  transactionHash?: string;
}

/**
 * Handle Transak webhook events.
 */
export async function handleTransakEvent(payload: Record<string, unknown>): Promise<{
  handled: boolean;
  detail: string;
}> {
  const eventName = payload.eventID as string | undefined;
  const webhookData = payload.webhookData as TransakOrderData | undefined;

  if (!webhookData?.id || !webhookData?.status) {
    return { handled: false, detail: "Missing order data in payload" };
  }

  const order = webhookData;

  switch (eventName) {
    case "ORDER_COMPLETED":
    case "ORDER_FAILED": {
      // Look up user by wallet address
      const userId: string | null = order.walletAddress
        ? (
            await sql`
              SELECT id FROM users
              WHERE wallet = ${order.walletAddress}
              LIMIT 1
            `
          ).rows[0]?.id ?? null
        : null;

      // Ensure transak_orders table exists
      await sql`
        CREATE TABLE IF NOT EXISTS transak_orders (
          id              TEXT PRIMARY KEY,
          user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
          status          TEXT NOT NULL,
          crypto_amount   NUMERIC,
          crypto_currency TEXT,
          fiat_amount     NUMERIC,
          fiat_currency   TEXT,
          wallet_address  TEXT,
          tx_hash         TEXT,
          created_at      TIMESTAMPTZ DEFAULT now(),
          updated_at      TIMESTAMPTZ DEFAULT now()
        )
      `;

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
          now(), now()
        )
        ON CONFLICT (id) DO UPDATE SET
          status        = EXCLUDED.status,
          crypto_amount = COALESCE(EXCLUDED.crypto_amount, transak_orders.crypto_amount),
          tx_hash       = COALESCE(EXCLUDED.tx_hash,       transak_orders.tx_hash),
          updated_at    = now()
      `;

      return {
        handled: true,
        detail: `Order ${order.id} → ${order.status}`,
      };
    }

    default:
      return {
        handled: false,
        detail: `Unhandled Transak event: ${eventName ?? "unknown"}`,
      };
  }
}
