/**
 * POST /api/routes-f/tip-send-multi-asset
 *
 * Build and return an unsigned multi-asset path payment transaction for tipping.
 * Supports cross-asset conversions (e.g., USDC → XLM) with slippage protection.
 *
 * Request body:
 * {
 *   senderAsset: "XLM" | "USDC" (asset the sender pays with)
 *   senderAmount: string (amount sender is willing to pay, e.g., "10.50")
 *   recipientAsset: "XLM" | "USDC" (asset recipient receives)
 *   recipientAmount: string (amount recipient receives, e.g., "50.0")
 *   recipientChannelId: string (channel ID to lookup recipient's wallet)
 *   maxSlippage: number (tolerance as percentage, e.g., 1.5 for 1.5%, default 1.0)
 *   strict?: "send" | "receive" (default "send" - sender pays exact amount, recipient gets ≥ minimum)
 *   memo?: string (optional memo for the transaction)
 * }
 *
 * Response 200:
 *   {
 *     transaction: string (XDR encoded unsigned transaction),
 *     senderAsset: string,
 *     senderAmount: string,
 *     recipientAsset: string,
 *     recipientAmount: string,
 *     recipientChannelId: string,
 *     sourceAccount: string,
 *     destinationAccount: string,
 *     networkPassphrase: string,
 *     maxSlippage: number,
 *     strict: "send" | "receive",
 *     fee: string (in XLM),
 *     network: "testnet" | "mainnet"
 *   }
 *
 * Error responses:
 *   400 — invalid body, missing trustline, invalid amount
 *   401 — unauthorized (no session)
 *   404 — recipient channel not found or no payment path found
 *   500 — transaction building failed
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Asset } from "@stellar/stellar-sdk";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import {
  buildPathPaymentTipTransaction,
  getUsdcAsset,
  hasTrustline,
  isValidStellarPublicKey,
  calculateFeeEstimate,
} from "@/lib/stellar/payments";
import { getStellarNetwork, getNetworkPassphrase } from "@/lib/stellar/config";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ASSETS = ["XLM", "USDC"] as const;

const tipSendMultiAssetSchema = z.object({
  senderAsset: z.enum(VALID_ASSETS),
  senderAmount: z
    .string()
    .regex(
      /^\d+(\.\d{1,7})?$/,
      "senderAmount must be a valid amount with up to 7 decimals"
    ),
  recipientAsset: z.enum(VALID_ASSETS),
  recipientAmount: z
    .string()
    .regex(
      /^\d+(\.\d{1,7})?$/,
      "recipientAmount must be a valid amount with up to 7 decimals"
    ),
  recipientChannelId: z.string().min(1, "recipientChannelId is required"),
  maxSlippage: z
    .number()
    .min(0, "maxSlippage must be >= 0")
    .max(100, "maxSlippage must be <= 100")
    .default(1.0),
  strict: z.enum(["send", "receive"]).default("send"),
  memo: z.string().max(28, "memo must be 28 characters or less").optional(),
});

type TipSendMultiAssetRequest = z.infer<typeof tipSendMultiAssetSchema>;

/**
 * Convert asset symbol to Stellar Asset object
 */
function assetFromSymbol(symbol: "XLM" | "USDC", network: "testnet" | "mainnet"): Asset {
  if (symbol === "XLM") {
    return Asset.native();
  }
  return getUsdcAsset(network);
}

/**
 * Get the recipient's wallet address from their channel ID
 */
async function getRecipientWallet(channelId: string): Promise<string | null> {
  try {
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
    console.error("[tip-send-multi-asset] Error fetching recipient wallet:", error);
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
      WHERE id = ${userId} AND deleted_at IS NULL
      LIMIT 1
    `;

    if (rows.length === 0) {
      return null;
    }

    const sender = rows[0] as any;
    return sender.stellar_address || sender.wallet_address || null;
  } catch (error) {
    console.error("[tip-send-multi-asset] Error fetching sender wallet:", error);
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
  const bodyResult = await validateBody(req, tipSendMultiAssetSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const {
    senderAsset,
    senderAmount,
    recipientAsset,
    recipientAmount,
    recipientChannelId,
    maxSlippage,
    strict,
    memo,
  } = bodyResult.data;

  try {
    // Validate amounts are positive
    const senderNum = parseFloat(senderAmount);
    const recipientNum = parseFloat(recipientAmount);
    if (!Number.isFinite(senderNum) || senderNum <= 0) {
      return NextResponse.json(
        { error: "senderAmount must be greater than 0" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(recipientNum) || recipientNum <= 0) {
      return NextResponse.json(
        { error: "recipientAmount must be greater than 0" },
        { status: 400 }
      );
    }

    // Prevent same-asset transfers (use simple payment instead)
    if (senderAsset === recipientAsset) {
      return NextResponse.json(
        { error: "senderAsset and recipientAsset must be different" },
        { status: 400 }
      );
    }

    const network = getStellarNetwork();
    const networkPassphrase = getNetworkPassphrase(network);

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

    // Convert asset symbols to Stellar Asset objects
    const sendAssetObj = assetFromSymbol(senderAsset, network);
    const receiveAssetObj = assetFromSymbol(recipientAsset, network);

    // Verify sender has trustline to send asset (if not native)
    if (!sendAssetObj.isNative()) {
      const hasSendTrustline = await hasTrustline(senderWallet, sendAssetObj, network);
      if (!hasSendTrustline) {
        return NextResponse.json(
          {
            error: `You don't have a ${senderAsset} trustline. Please establish it first.`,
            needsTrustline: true,
            asset: senderAsset,
            accountType: "sender",
          },
          { status: 400 }
        );
      }
    }

    // Verify recipient has trustline to receive asset (if not native)
    if (!receiveAssetObj.isNative()) {
      const hasReceiveTrustline = await hasTrustline(
        recipientWallet,
        receiveAssetObj,
        network
      );
      if (!hasReceiveTrustline) {
        return NextResponse.json(
          {
            error: `Recipient doesn't have a ${recipientAsset} trustline. Ask them to establish it first.`,
            needsTrustline: true,
            asset: recipientAsset,
            accountType: "recipient",
          },
          { status: 400 }
        );
      }
    }

    // Build the path payment transaction
    const transaction = await buildPathPaymentTipTransaction({
      sourcePublicKey: senderWallet,
      destinationPublicKey: recipientWallet,
      sendAsset: sendAssetObj,
      sendAmount: senderAmount,
      receiveAsset: receiveAssetObj,
      receiveAmount: recipientAmount,
      maxSlippage,
      network,
      memo,
      strict,
    });

    const fee = calculateFeeEstimate();

    return NextResponse.json(
      {
        transaction: transaction.toEnvelope().toXDR("base64"),
        senderAsset,
        senderAmount,
        recipientAsset,
        recipientAmount,
        recipientChannelId,
        sourceAccount: senderWallet,
        destinationAccount: recipientWallet,
        networkPassphrase,
        maxSlippage,
        strict,
        fee: String(fee),
        network,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[tip-send-multi-asset] Error building transaction:", error);

    if (error instanceof Error) {
      const msg = error.message;

      if (msg.includes("Account not found")) {
        return NextResponse.json(
          { error: "Sender account not found. Please ensure your wallet is funded." },
          { status: 400 }
        );
      }

      if (msg.includes("trustline")) {
        return NextResponse.json(
          { error: msg, needsTrustline: true },
          { status: 400 }
        );
      }

      if (msg.includes("No payment path")) {
        return NextResponse.json(
          {
            error: `No payment path found. Conversion may not be available at ${msg.includes("slippage") ? "the requested slippage tolerance" : "this time"}. Try increasing maxSlippage.`,
            noPath: true,
          },
          { status: 404 }
        );
      }

      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to build multi-asset transaction. Please try again." },
      { status: 500 }
    );
  }
}
