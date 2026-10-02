/**
 * POST /api/routes-f/subscription-gift
 * Body: { tierId: string, recipientUserId: string, gifterWallet: string }
 * Returns an unsigned Soroban invocation transaction targeting the subscription
 * contract's gift_subscription function, for the gifter to sign with a wallet
 * (e.g. Freighter). The recipient receives the subscription; the gifter pays.
 */
import { NextRequest, NextResponse } from "next/server";
import { getTierPrice } from "./seedData";
import { buildGiftIntentTx, isValidWallet } from "./utils";
import type { GiftIntentBody, GiftIntentResponse } from "./types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Partial<GiftIntentBody>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { tierId, recipientUserId, gifterWallet } = body;

  if (!tierId || typeof tierId !== "string") {
    return NextResponse.json({ error: "tierId is required" }, { status: 400 });
  }
  if (!recipientUserId || typeof recipientUserId !== "string") {
    return NextResponse.json(
      { error: "recipientUserId is required" },
      { status: 400 }
    );
  }
  if (!gifterWallet || typeof gifterWallet !== "string") {
    return NextResponse.json(
      { error: "gifterWallet is required" },
      { status: 400 }
    );
  }
  if (!isValidWallet(gifterWallet)) {
    return NextResponse.json(
      { error: "gifterWallet must be a valid Stellar public key" },
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

  const intent = buildGiftIntentTx(tierId, recipientUserId, gifterWallet);

  return NextResponse.json(intent as GiftIntentResponse, { status: 201 });
}
