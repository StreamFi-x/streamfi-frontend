/**
 * POST /api/routes-f/wallet-trustline
 *
 * Build and return an unsigned ChangeTrust transaction to establish a trustline
 * to a non-native Stellar asset (e.g., USDC).
 *
 * Request body:
 * {
 *   publicKey: string (account that will establish the trustline)
 *   assetCode: "USDC" | string (asset code, default "USDC")
 *   assetIssuer: string (issuer account public key, optional - defaults to configured issuer)
 *   network: "testnet" | "mainnet"
 *   memo?: string (optional transaction memo)
 * }
 *
 * Response 200:
 * {
 *   transaction: string (XDR encoded unsigned transaction),
 *   publicKey: string,
 *   assetCode: string,
 *   assetIssuer: string,
 *   networkPassphrase: string,
 *   fee: string (in XLM),
 *   network: "testnet" | "mainnet"
 * }
 *
 * Error responses:
 *   400 — invalid public key, invalid asset, validation error
 *   401 — unauthorized (no session)
 *   500 — transaction building failed
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Asset, StrKey, Transaction } from "@stellar/stellar-sdk";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import {
  buildChangeTrustTransaction,
  getUsdcAssetIssuer,
} from "@/lib/stellar/payments";
import { getStellarNetwork } from "@/lib/stellar/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const walletTrustlineSchema = z.object({
  publicKey: z.string().min(1, "publicKey is required"),
  assetCode: z.string().default("USDC"),
  assetIssuer: z.string().optional(),
  network: z.enum(["testnet", "mainnet"]).default("mainnet"),
  memo: z.string().max(28, "memo must be 28 characters or less").optional(),
});

type WalletTrustlineRequest = z.infer<typeof walletTrustlineSchema>;

interface WalletTrustlineResponse {
  transaction: string;
  publicKey: string;
  assetCode: string;
  assetIssuer: string;
  networkPassphrase: string;
  fee: string;
  network: "testnet" | "mainnet";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify session
  const session = await verifySession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate request body
  const validation = await validateBody(req, walletTrustlineSchema);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: validation.error },
      { status: 400 }
    );
  }

  const { publicKey, assetCode, assetIssuer, network, memo } = validation.data;

  // Validate public key format
  if (!StrKey.isValidEd25519PublicKey(publicKey)) {
    return NextResponse.json(
      { error: "Invalid Stellar public key format" },
      { status: 400 }
    );
  }

  try {
    // Get the asset issuer - use provided issuer or default to configured USDC issuer
    let issuer = assetIssuer;
    if (!issuer) {
      if (assetCode === "USDC") {
        issuer = getUsdcAssetIssuer(network);
      } else {
        return NextResponse.json(
          {
            error:
              "assetIssuer is required for non-USDC assets",
          },
          { status: 400 }
        );
      }
    }

    // Validate issuer public key format
    if (!StrKey.isValidEd25519PublicKey(issuer)) {
      return NextResponse.json(
        { error: "Invalid asset issuer public key format" },
        { status: 400 }
      );
    }

    // Create the Asset object
    const asset = new Asset(assetCode, issuer);

    // Build the ChangeTrust transaction
    const transaction = await buildChangeTrustTransaction(
      publicKey,
      asset,
      network,
      memo
    );

    // Get network passphrase for client
    const networkPassphrase =
      network === "testnet"
        ? "Test SDF Network ; September 2015"
        : "Public Global Stellar Network ; September 2015";

    const response: WalletTrustlineResponse = {
      transaction: transaction.toXDR(),
      publicKey,
      assetCode,
      assetIssuer: issuer,
      networkPassphrase,
      fee: (parseInt(transaction.fee) / 1e7).toFixed(7),
      network,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[wallet-trustline] Error building transaction:", error);

    const message =
      error instanceof Error ? error.message : "Failed to build trustline transaction";

    // Distinguish between different error types
    if (message.includes("Account not found")) {
      return NextResponse.json(
        {
          error:
            "Account not found on the Stellar network. The account must be funded before establishing a trustline.",
        },
        { status: 400 }
      );
    }

    if (message.includes("Invalid")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to build trustline transaction", details: message },
      { status: 500 }
    );
  }
}
