/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Stellar Payment Webhook Handler
 * 
 * POST /api/routes-f/webhooks-stellar-payment
 * 
 * Ingests Stellar payment stream events keyed by memo to credit tips.
 * Verifies transactions on Horizon API before processing to prevent fraud.
 * 
 * Expected payload:
 * {
 *   tx_hash: string;
 *   from: string;        // Source Stellar address
 *   to: string;          // Destination Stellar address
 *   amount: string;      // XLM amount
 *   memo?: string;       // Transaction memo (optional)
 *   ledger?: number;     // Ledger number (optional)
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { evaluateAndAwardBadges } from "@/lib/routes-f/badges";
import { writeNotification } from "@/lib/notifications";
import { createRateLimiter } from "@/lib/rate-limit";
import { createHmac, timingSafeEqual } from "crypto";

// Rate limiter: max 60 requests per minute per IP
const isRateLimited = createRateLimiter(60 * 1000, 60);

const paymentSchema = z.object({
  tx_hash: z.string().min(1),
  from: z.string().regex(/^G[A-Z0-9]{55}$/), // Stellar public key format
  to: z.string().regex(/^G[A-Z0-9]{55}$/),
  amount: z.string().regex(/^\d+(\.\d{1,7})?$/), // XLM amount (max 7 decimals)
  memo: z.string().optional(),
  ledger: z.number().int().positive().optional(),
  timestamp: z.number().int().positive().optional(),
});

type PaymentPayload = z.infer<typeof paymentSchema>;

/**
 * Verify webhook signature (optional - for third-party webhook services)
 * If STELLAR_WEBHOOK_SECRET is set, verify HMAC signature
 */
function verifyWebhookSignature(
  req: NextRequest,
  rawBody: string
): boolean {
  const webhookSecret = process.env.STELLAR_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    // No secret configured - skip verification (dev mode)
    console.warn("⚠️ STELLAR_WEBHOOK_SECRET not set — skipping signature verification");
    return true;
  }

  const signatureHeader = req.headers.get("x-stellar-signature");
  if (!signatureHeader) {
    console.error("❌ Missing x-stellar-signature header");
    return false;
  }

  // Expected format: "t=<timestamp>,v1=<signature>"
  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const [k, v] = part.split("=");
    if (k && v) {
      parts[k.trim()] = v.trim();
    }
  }

  const timestamp = parts["t"];
  const signature = parts["v1"];

  if (!timestamp || !signature) {
    console.error("❌ Invalid signature header format");
    return false;
  }

  // Reject events older than 5 minutes (replay attack prevention)
  const ageSeconds = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
  if (ageSeconds > 300) {
    console.error(`❌ Webhook too old: ${ageSeconds}s`);
    return false;
  }

  // Verify HMAC-SHA256 signature
  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Verify transaction on Stellar Horizon API
 * This prevents processing fake/forged webhook payloads
 */
async function verifyTransactionOnHorizon(
  txHash: string,
  payload: PaymentPayload
): Promise<{ verified: boolean; error?: string }> {
  try {
    const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
    const horizonUrl =
      network === "mainnet"
        ? "https://horizon.stellar.org"
        : "https://horizon-testnet.stellar.org";

    const response = await fetch(`${horizonUrl}/transactions/${txHash}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return { verified: false, error: "Transaction not found on network" };
      }
      return { verified: false, error: `Horizon API error: ${response.status}` };
    }

    const txData = await response.json();

    // Verify transaction was successful
    if (!txData.successful) {
      return { verified: false, error: "Transaction was not successful" };
    }

    // Fetch operations to verify payment details
    const opsResponse = await fetch(txData._links.operations.href);
    if (!opsResponse.ok) {
      return { verified: false, error: "Failed to fetch transaction operations" };
    }

    const opsData = await opsResponse.json();
    const paymentOp = opsData._embedded.records.find(
      (op: any) => op.type === "payment" && op.asset_type === "native"
    );

    if (!paymentOp) {
      return { verified: false, error: "No native payment operation found" };
    }

    // Verify payment details match payload
    if (paymentOp.from !== payload.from) {
      return { verified: false, error: "Source address mismatch" };
    }
    if (paymentOp.to !== payload.to) {
      return { verified: false, error: "Destination address mismatch" };
    }
    
    // Allow small rounding differences (within 0.0000001 XLM)
    const horizonAmount = parseFloat(paymentOp.amount);
    const payloadAmount = parseFloat(payload.amount);
    if (Math.abs(horizonAmount - payloadAmount) > 0.0000001) {
      return { verified: false, error: "Amount mismatch" };
    }

    return { verified: true };
  } catch (error) {
    console.error("❌ Horizon verification error:", error);
    return { verified: false, error: "Failed to verify transaction on network" };
  }
}

/**
 * Get current XLM price in USD from CoinGecko
 */
async function getXLMPrice(): Promise<number> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd",
      { next: { revalidate: 300 } } // Cache for 5 minutes
    );
    const data = await response.json();
    return data.stellar?.usd || 0.12; // Fallback price
  } catch (error) {
    console.error("Failed to fetch XLM price:", error);
    return 0.12; // Fallback price
  }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    if (await isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    // Get raw body for signature verification
    const rawBody = await req.text();

    // Verify webhook signature if secret is configured
    if (!verifyWebhookSignature(req, rawBody)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse and validate payload
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const bodyResult = paymentSchema.safeParse(parsedBody);
    if (!bodyResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: bodyResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const payload = bodyResult.data;
    console.log(`🔔 Stellar payment webhook received: ${payload.tx_hash}`);

    // Verify transaction exists on Stellar network
    const verification = await verifyTransactionOnHorizon(payload.tx_hash, payload);
    if (!verification.verified) {
      console.error(`❌ Transaction verification failed: ${verification.error}`);
      return NextResponse.json(
        { error: "Transaction verification failed", details: verification.error },
        { status: 400 }
      );
    }

    // Check if transaction already processed (idempotency)
    const existingTx = await sql`
      SELECT id FROM tip_transactions WHERE tx_hash = ${payload.tx_hash}
    `;

    if (existingTx.rows.length > 0) {
      console.log(`⏭️ Transaction already processed: ${payload.tx_hash}`);
      return NextResponse.json({
        message: "Transaction already processed",
        tx_hash: payload.tx_hash,
      });
    }

    // Find creator by wallet address
    const creatorResult = await sql`
      SELECT id, username, wallet FROM users WHERE wallet = ${payload.to}
    `;

    if (creatorResult.rows.length === 0) {
      console.error(`❌ Creator not found for wallet: ${payload.to}`);
      return NextResponse.json(
        { error: "Creator wallet not found" },
        { status: 404 }
      );
    }

    const creator = creatorResult.rows[0];

    // Find supporter by wallet address (optional - may be anonymous)
    let supporterId: string | null = null;
    let supporterUsername = "Anonymous";
    
    const supporterResult = await sql`
      SELECT id, username FROM users WHERE wallet = ${payload.from}
    `;

    if (supporterResult.rows.length > 0) {
      supporterId = supporterResult.rows[0].id;
      supporterUsername = supporterResult.rows[0].username;
    }

    // Get current XLM price in USD
    const xlmPriceUSD = await getXLMPrice();
    const amountXLM = parseFloat(payload.amount);
    const priceUSD = amountXLM * xlmPriceUSD;

    // Insert tip transaction
    await sql`
      INSERT INTO tip_transactions (
        creator_id,
        supporter_id,
        amount_xlm,
        price_usd,
        tx_hash,
        memo,
        created_at
      )
      VALUES (
        ${creator.id},
        ${supporterId},
        ${amountXLM},
        ${priceUSD},
        ${payload.tx_hash},
        ${payload.memo || null},
        NOW()
      )
      ON CONFLICT (tx_hash) DO NOTHING
    `;

    // Update creator's tip statistics
    await sql`
      UPDATE users SET
        total_tips_received = COALESCE(total_tips_received, 0) + ${amountXLM},
        total_tips_count = COALESCE(total_tips_count, 0) + 1,
        last_tip_at = NOW()
      WHERE id = ${creator.id}
    `;

    console.log(`✅ Tip credited: ${amountXLM} XLM ($${priceUSD.toFixed(2)}) to ${creator.username}`);

    // Send notification to creator
    try {
      await writeNotification(
        creator.id,
        "live",
        "New Tip Received!",
        `${supporterUsername} tipped you ${amountXLM.toFixed(7)} XLM ($${priceUSD.toFixed(2)})`
      );
    } catch (notifError) {
      console.error("Failed to send notification:", notifError);
    }

    // Evaluate and award badges (e.g., "First Tip" badge)
    try {
      await evaluateAndAwardBadges(creator.id);
    } catch (badgeError) {
      console.error("Failed to evaluate badges:", badgeError);
    }

    return NextResponse.json({
      message: "Payment processed successfully",
      tx_hash: payload.tx_hash,
      creator: creator.username,
      amount_xlm: amountXLM,
      amount_usd: priceUSD,
    });
  } catch (error) {
    console.error("❌ Stellar payment webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Stellar payment webhook endpoint is active",
    network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet",
  });
}
