/**
 * POST /api/routes-f/tip-send-usdc
 * 
 * Build and return an unsigned USDC payment transaction for tipping.
 * 
 * Request body:
 * {
 *   amount: string (USDC amount, e.g., "10.0000000")
 *   recipientChannelId: string (channel ID to lookup recipient's wallet)
 *   memo?: string (optional memo for the transaction)
 * }
 * 
 * Response 200:
 *   {
 *     transaction: string (XDR encoded unsigned transaction),
 *     amount: string,
 *     recipientChannelId: string,
 *     sourceAccount: string (computed from session),
 *     destinationAccount: string (looked up from recipientChannelId),
 *     networkPassphrase: string,
 *     fee: string (in XLM),
 *   }
 * 
 * Error responses:
 *   400 — invalid body, missing fields, invalid amount
 *   401 — unauthorized (no session)
 *   404 — recipient channel not found
 *   500 — transaction building failed
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { buildTipTransaction, isValidStellarPublicKey, formatXLMAmount, calculateFeeEstimate } from "@/lib/stellar/payments";
import { getStellarNetwork, getNetworkPassphrase } from "@/lib/stellar/config";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tipSendUsdcSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,7})?$/, "amount must be a valid USDC amount with up to 7 decimals"),
  recipientChannelId: z.string().min(1, "recipientChannelId is required"),
  memo: z.string().max(28, "memo must be 28 characters or less").optional(),
});

type TipSendUsdcRequest = z.infer<typeof tipSendUsdcSchema>;

/**
 * Get the recipient's wallet address from their channel ID
 */
async function getRecipientWallet(channelId: string): Promise<string | null> {
  try {
    // Query the database for the channel's wallet address
    // Assuming a channels table with stellar_address or similar
    const { rows } = await sql`
      SELECT stellar_address, wallet_address 
      FROM channels 
      WHERE channel_id = ${channelId} 
      LIMIT 1
    `;

    if (rows.length === 0) {
      return null;
    }

    const recipient = rows[0] as any;
    return recipient.stellar_address || recipient.wallet_address || null;
  } catch (error) {
    console.error("[tip-send-usdc] Error fetching recipient wallet:", error);
    throw error;
  }
}

/**
 * Get the sender's wallet address from their user ID
 */
async function getSenderWallet(userId: string): Promise<string | null> {
  try {
    const { rows } = await sql`
      SELECT stellar_address, wallet_address 
      FROM users 
      WHERE id = ${userId} 
      LIMIT 1
    `;

    if (rows.length === 0) {
      return null;
    }

    const sender = rows[0] as any;
    return sender.stellar_address || sender.wallet_address || null;
  } catch (error) {
    console.error("[tip-send-usdc] Error fetching sender wallet:", error);
    throw error;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify session
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  // Validate request body
  const bodyResult = await validateBody(req, tipSendUsdcSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { amount, recipientChannelId, memo } = bodyResult.data;

  try {
    // Validate amount is positive
    const amountNum = parseFloat(amount);
    if (amountNum <= 0) {
      return NextResponse.json(
        { error: "amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Get sender's wallet
    const senderWallet = await getSenderWallet(session.userId);
    if (!senderWallet || !isValidStellarPublicKey(senderWallet)) {
      return NextResponse.json(
        { error: "Sender wallet not found or invalid" },
        { status: 400 }
      );
    }

    // Get recipient's wallet
    const recipientWallet = await getRecipientWallet(recipientChannelId);
    if (!recipientWallet) {
      return NextResponse.json(
        { error: "Recipient channel not found" },
        { status: 404 }
      );
    }

    if (!isValidStellarPublicKey(recipientWallet)) {
      return NextResponse.json(
        { error: "Recipient wallet address is invalid" },
        { status: 400 }
      );
    }

    // Prevent self-tipping
    if (senderWallet === recipientWallet) {
      return NextResponse.json(
        { error: "Cannot tip yourself" },
        { status: 400 }
      );
    }

    // Get network configuration
    const network = getStellarNetwork();
    const networkPassphrase = getNetworkPassphrase(network);

    // Build the unsigned transaction
    const transaction = await buildTipTransaction({
      sourcePublicKey: senderWallet,
      destinationPublicKey: recipientWallet,
      amount: formatXLMAmount(amountNum), // Same format for USDC
      network,
      assetCode: "USDC"
    });

    // Convert transaction to XDR (for client to sign)
    const transactionXdr = transaction.toEnvelope().toXDR("base64");

    // Calculate fee (fee is paid in native XLM)
    const fee = formatXLMAmount(calculateFeeEstimate());

    return NextResponse.json(
      {
        transaction: transactionXdr,
        amount,
        recipientChannelId,
        sourceAccount: senderWallet,
        destinationAccount: recipientWallet,
        networkPassphrase,
        fee,
        network,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[tip-send-usdc] Error building transaction:", error);

    // Check if it's an account funding error
    if (error instanceof Error) {
      if (error.message.includes("Account not found")) {
        return NextResponse.json(
          { error: "Sender account not found. Please ensure your wallet is funded." },
          { status: 400 }
        );
      }
      if (error.message.includes("Recipient")) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to build transaction. Please try again." },
      { status: 500 }
    );
  }
}
