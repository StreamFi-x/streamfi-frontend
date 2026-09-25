import { NextRequest, NextResponse } from "next/server";
import type { GiftSubscriptionBody, GiftResponse } from "./types";
import { createGift, createBulkGifts, validTiers } from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: GiftSubscriptionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { gifter_id, recipient_id, creator_id, tier_id, payment_tx_hash, is_bulk, bulk_count, recipients } = body;

  // Validate required fields
  if (!gifter_id || typeof gifter_id !== "string") {
    return NextResponse.json({ error: "gifter_id is required" }, { status: 400 });
  }
  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }
  if (!tier_id || typeof tier_id !== "string") {
    return NextResponse.json({ error: "tier_id is required" }, { status: 400 });
  }
  if (!payment_tx_hash || typeof payment_tx_hash !== "string") {
    return NextResponse.json({ error: "payment_tx_hash is required" }, { status: 400 });
  }

  // Validate creator has this tier
  const creatorTiers = validTiers[creator_id];
  if (!creatorTiers) {
    return NextResponse.json(
      { error: `creator '${creator_id}' not found` },
      { status: 404 }
    );
  }
  if (!creatorTiers.includes(tier_id)) {
    return NextResponse.json(
      { error: `tier '${tier_id}' is not valid for creator '${creator_id}'` },
      { status: 400 }
    );
  }

  // Bulk gifting path
  if (is_bulk) {
    const count = typeof bulk_count === "number" && bulk_count > 0 ? Math.min(bulk_count, 50) : 5;
    const { gifts } = createBulkGifts(
      gifter_id,
      creator_id,
      tier_id,
      payment_tx_hash,
      count,
      recipients
    );
    const bulkResults = gifts.map((g) => ({
      gift_id: g.gift_id,
      recipient_id: g.recipient_id,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));
    return NextResponse.json(
      {
        message: `Successfully gifted ${count} subscriptions`,
        bulk_gifts: bulkResults,
      },
      { status: 201 }
    );
  }

  // Single gifting path
  if (!recipient_id || typeof recipient_id !== "string") {
    return NextResponse.json({ error: "recipient_id is required" }, { status: 400 });
  }

  // Cannot gift to yourself
  if (gifter_id === recipient_id) {
    return NextResponse.json(
      { error: "gifter_id and recipient_id must be different" },
      { status: 400 }
    );
  }

  const { gift, subscription, isStacked } = createGift(
    gifter_id,
    recipient_id,
    creator_id,
    tier_id,
    payment_tx_hash
  );

  return NextResponse.json(
    {
      gift_id: gift.gift_id,
      recipient_id: gift.recipient_id,
      is_stacked: isStacked,
      expires_at: subscription.expires_at,
    } as GiftResponse,
    { status: 201 }
  );
}
