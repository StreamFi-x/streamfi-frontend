/**
 * POST /api/routes-f/subscription-community-gifting
 * Body: { tierId: string, count: number, creatorId: string, gifterWallet: string }
 * Picks the next `count` active chatters in a creator's channel (most-recent
 * chat activity first, skipping anyone already subscribed) and returns a single
 * unsigned Soroban invocation that gifts each of them a `tierId` subscription.
 */
import { NextRequest, NextResponse } from "next/server";
import { MAX_GIFT_COUNT, getEligibleChatters, getTierPrice } from "./seedData";
import {
  buildCommunityGiftTx,
  isPositiveInteger,
  isValidWallet,
} from "./utils";
import type { CommunityGiftingBody, CommunityGiftingResponse } from "./types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Partial<CommunityGiftingBody>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { tierId, count, creatorId, gifterWallet } = body;

  if (!tierId || typeof tierId !== "string") {
    return NextResponse.json({ error: "tierId is required" }, { status: 400 });
  }
  if (!creatorId || typeof creatorId !== "string") {
    return NextResponse.json(
      { error: "creatorId is required" },
      { status: 400 }
    );
  }
  if (!isPositiveInteger(count)) {
    return NextResponse.json(
      { error: "count must be a positive integer" },
      { status: 400 }
    );
  }
  if (count > MAX_GIFT_COUNT) {
    return NextResponse.json(
      { error: `count must not exceed ${MAX_GIFT_COUNT}` },
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

  if (!getTierPrice(tierId)) {
    return NextResponse.json(
      {
        error: "Unknown tier",
        message: `tierId "${tierId}" is not a known subscription tier.`,
      },
      { status: 404 }
    );
  }

  const eligible = getEligibleChatters(creatorId);
  if (!eligible) {
    return NextResponse.json(
      { error: `creator "${creatorId}" not found` },
      { status: 404 }
    );
  }

  if (count > eligible.length) {
    return NextResponse.json(
      {
        error: "Not enough eligible chatters",
        message: `Requested ${count} gift subs but only ${eligible.length} eligible chatter(s) are available for creator "${creatorId}".`,
        requested_count: count,
        available_count: eligible.length,
      },
      { status: 409 }
    );
  }

  const recipients = eligible.slice(0, count);
  const intent = buildCommunityGiftTx(
    tierId,
    creatorId,
    recipients,
    count,
    gifterWallet
  );

  return NextResponse.json(intent as CommunityGiftingResponse, { status: 201 });
}
