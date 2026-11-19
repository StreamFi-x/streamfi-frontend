/**
 * POST /api/routes-f/tip-send-multi-asset-v2
 *
 * Build and return an unsigned multi-asset path payment transaction for tipping.
 * Supports cross-asset conversions (e.g., USDC → XLM, XLM → USDC) with slippage protection.
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

const tipSendMultiAssetSchema = z.object({
  senderAsset: z.enum(["XLM", "USDC"]),
  senderAmount: z.string().regex(/^\d+(\.\d{1,7})?$/, "Invalid amount"),
  recipientAsset: z.enum(["XLM", "USDC"]),
  recipientAmount: z.string().regex(/^\d+(\.\d{1,7})?$/, "Invalid amount"),
  recipientChannelId: z.string().min(1),
  maxSlippage: z.number().min(0).max(100).default(1.0),
  strict: z.enum(["send", "receive"]).default("send"),
});

function assetFromSymbol(symbol: "XLM" | "USDC", network: "testnet" | "mainnet"): Asset {
  return symbol === "XLM" ? Asset.native() : getUsdcAsset(network);
}

async function getRecipientWallet(channelId: string): Promise<string | null> {
  try {
    const { rows } = await sql`
      SELECT stellar_address, wallet_address
      FROM channels
      WHERE channel_id = ${channelId}
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    const recipient = rows[0] as any;
    return recipient.stellar_address || recipient.wallet_address || null;
  } catch (error) {
    console.error("[tip-send-multi-asset-v2] Error:", error);
    throw error;
  }
}

async function getSenderWallet(userId: string): Promise<string | null> {
  try {
    const { rows } = await sql`
      SELECT stellar_address, wallet_address
      FROM users
      WHERE id = ${userId}::UUID AND deleted_at IS NULL
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    const sender = rows[0] as any;
    return sender.stellar_address || sender.wallet_address || null;
  } catch (error) {
    console.error("[tip-send-multi-asset-v2] Error:", error);
    throw error;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

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
  } = bodyResult.data;

  try {
    const senderNum = parseFloat(senderAmount);
    const recipientNum = parseFloat(recipientAmount);

    if (!Number.isFinite(senderNum) || senderNum <= 0) {
      return NextResponse.json({ error: "senderAmount must be > 0" }, { status: 400 });
    }
    if (!Number.isFinite(recipientNum) || recipientNum <= 0) {
      return NextResponse.json({ error: "recipientAmount must be > 0" }, { status: 400 });
    }

    if (senderAsset === recipientAsset) {
      return NextResponse.json(
        { error: "Assets must be different" },
        { status: 400 }
      );
    }

    const network = getStellarNetwork();
    const networkPassphrase = getNetworkPassphrase(network);

    const senderWallet = await getSenderWallet(session.userId);
    if (!senderWallet || !isValidStellarPublicKey(senderWallet)) {
      return NextResponse.json({ error: "Sender wallet invalid" }, { status: 400 });
    }

    const recipientWallet = await getRecipientWallet(recipientChannelId);
    if (!recipientWallet) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    if (!isValidStellarPublicKey(recipientWallet)) {
      return NextResponse.json({ error: "Recipient wallet invalid" }, { status: 400 });
    }

    if (senderWallet === recipientWallet) {
      return NextResponse.json({ error: "Cannot tip yourself" }, { status: 400 });
    }

    const sendAssetObj = assetFromSymbol(senderAsset, network);
    const receiveAssetObj = assetFromSymbol(recipientAsset, network);

    // Verify trustlines
    if (!sendAssetObj.isNative()) {
      const hasSendTrustline = await hasTrustline(senderWallet, sendAssetObj, network);
      if (!hasSendTrustline) {
        return NextResponse.json(
          { error: `You don't have ${senderAsset} trustline`, needsTrustline: true },
          { status: 400 }
        );
      }
    }

    if (!receiveAssetObj.isNative()) {
      const hasReceiveTrustline = await hasTrustline(recipientWallet, receiveAssetObj, network);
      if (!hasReceiveTrustline) {
        return NextResponse.json(
          { error: `Recipient needs ${recipientAsset} trustline`, needsTrustline: true },
          { status: 400 }
        );
      }
    }

    // Build path payment
    const transaction = await buildPathPaymentTipTransaction({
      sourcePublicKey: senderWallet,
      destinationPublicKey: recipientWallet,
      sendAsset: sendAssetObj,
      sendAmount: senderAmount,
      receiveAsset: receiveAssetObj,
      receiveAmount: recipientAmount,
      maxSlippage,
      network,
      strict,
    });

    return NextResponse.json(
      {
        transaction: transaction.toEnvelope().toXDR("base64"),
        senderAsset,
        senderAmount,
        recipientAsset,
        recipientAmount,
        maxSlippage,
        strict,
        fee: String(calculateFeeEstimate()),
        network,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[tip-send-multi-asset-v2] Error:", error);

    if (error instanceof Error) {
      const msg = error.message;
      if (msg.includes("trustline")) {
        return NextResponse.json({ error: msg, needsTrustline: true }, { status: 400 });
      }
      if (msg.includes("No payment path")) {
        return NextResponse.json({ error: "No path found. Try increasing maxSlippage.", noPath: true }, { status: 404 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to build transaction" }, { status: 500 });
  }
}
