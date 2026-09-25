/**
 * POST /api/routes-f/subscription-purchase-intent
 * Body: { tierId: string, subscriberWallet: string }
 * Returns an unsigned Soroban invocation transaction targeting the
 * subscription contract's purchase_subscription function, for the client
 * to sign with a wallet (e.g. Freighter).
 */
import { NextRequest, NextResponse } from "next/server";
import { getTierPrice } from "./seedData";
import { buildPurchaseIntentTx, isValidWallet } from "./utils";
import type { PurchaseIntentBody, PurchaseIntentResponse } from "./types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Partial<PurchaseIntentBody>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { tierId, subscriberWallet } = body;

  if (!tierId || typeof tierId !== "string") {
    return NextResponse.json({ error: "tierId is required" }, { status: 400 });
  }
  if (!subscriberWallet || typeof subscriberWallet !== "string") {
    return NextResponse.json(
      { error: "subscriberWallet is required" },
      { status: 400 }
    );
  }
  if (!isValidWallet(subscriberWallet)) {
    return NextResponse.json(
      { error: "subscriberWallet must be a valid Stellar public key" },
      { status: 400 }
    );
  }

  const tier = getTierPrice(tierId);
  if (!tier) {
    return NextResponse.json(
      {
        error: "Unknown tier",
        message: `tierId "${tierId}" is not a known subscription tier.`,
      },
      { status: 404 }
    );
  }

  const intent = buildPurchaseIntentTx(tierId, subscriberWallet);

  return NextResponse.json(intent as PurchaseIntentResponse, { status: 201 });
}
