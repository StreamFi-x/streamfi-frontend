/**
 * POST /api/routes-f/subscription-anonymous-gift
 * Body: { tierId: string, recipientUserId: string, gifterWallet: string }
 * Same as subscription-gift, but the returned invocation targets
 * gift_subscription_anonymous: the recipient's subscription is attributed to
 * "Anonymous" in every public view (gift feed, subscriber badge, alerts) while
 * the contract still records the real gifter wallet for accounting/refunds.
 */
import { NextRequest, NextResponse } from "next/server";
import { getTierPrice } from "./seedData";
import { buildAnonymousGiftIntentTx, isValidWallet } from "./utils";
import type {
  AnonymousGiftIntentBody,
  AnonymousGiftIntentResponse,
} from "./types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Partial<AnonymousGiftIntentBody>;
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

  const intent = buildAnonymousGiftIntentTx(
    tierId,
    recipientUserId,
    gifterWallet
  );

  return NextResponse.json(intent as AnonymousGiftIntentResponse, {
    status: 201,
  });
}
