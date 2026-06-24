/**
 * POST /api/routes-f/subscriptions
 * Subscribe a user to a creator for a given tier.
 * Uses in-memory storage (mock) — no real DB.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

// ---------------------------------------------------------------------------
// Tier configuration (mock)
// ---------------------------------------------------------------------------
interface TierConfig {
  label: string;
  durationDays: number;
}

const TIERS: Record<string, TierConfig> = {
  basic: { label: "Basic", durationDays: 30 },
  standard: { label: "Standard", durationDays: 90 },
  premium: { label: "Premium", durationDays: 365 },
};

// ---------------------------------------------------------------------------
// In-memory storage
// ---------------------------------------------------------------------------
export interface Subscription {
  subscription_id: string;
  subscriber_id: string;
  creator_id: string;
  tier_id: string;
  payment_tx_hash: string;
  asset: "XLM" | "USDC";
  started_at: string;
  expires_at: string;
  status?: "active" | "cancelled";
}

// Exported so tests can reset between runs.
export const subscriptions: Map<string, Subscription> = new Map();

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const createSubscriptionSchema = z.object({
  subscriber_id: z.string().uuid(),
  creator_id: z.string().uuid(),
  tier_id: z.string().min(1),
  payment_tx_hash: z.string().min(1),
  asset: z.enum(["XLM", "USDC"]),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateId(): string {
  // crypto.randomUUID() is available in Node 18+ and in the Next.js edge/node runtime.
  return crypto.randomUUID();
}

function findActiveSubscription(
  subscriberId: string,
  creatorId: string,
  now: number
): Subscription | undefined {
  for (const sub of subscriptions.values()) {
    if (
      sub.subscriber_id === subscriberId &&
      sub.creator_id === creatorId &&
      new Date(sub.expires_at).getTime() > now
    ) {
      return sub;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const subscriptionId = searchParams.get("subscription_id");
  if (!subscriptionId) {
    return NextResponse.json({ error: "subscription_id is required" }, { status: 400 });
  }

  const sub = subscriptions.get(subscriptionId);
  if (!sub) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  return NextResponse.json(sub);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, createSubscriptionSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { subscriber_id, creator_id, tier_id, payment_tx_hash, asset } =
    bodyResult.data;

  // Validate tier
  const tier = TIERS[tier_id];
  if (!tier) {
    return NextResponse.json(
      {
        error: "Unknown tier",
        message: `tier_id "${tier_id}" is not valid. Valid tiers: ${Object.keys(TIERS).join(", ")}.`,
      },
      { status: 404 }
    );
  }

  const now = Date.now();

  // Check for an already-active subscription
  const existing = findActiveSubscription(subscriber_id, creator_id, now);
  if (existing) {
    return NextResponse.json(
      {
        error: "Subscription already active",
        message:
          "This subscriber already has an active subscription to this creator.",
        subscription_id: existing.subscription_id,
        expires_at: existing.expires_at,
      },
      { status: 409 }
    );
  }

  // Compute timestamps
  const started_at = new Date(now).toISOString();
  const expires_at = new Date(
    now + tier.durationDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const subscription: Subscription = {
    subscription_id: generateId(),
    subscriber_id,
    creator_id,
    tier_id,
    payment_tx_hash,
    asset,
    started_at,
    expires_at,
    status: "active",
  };

  subscriptions.set(subscription.subscription_id, subscription);

  return NextResponse.json(
    {
      subscription_id: subscription.subscription_id,
      subscriber_id: subscription.subscriber_id,
      creator_id: subscription.creator_id,
      tier_id: subscription.tier_id,
      started_at: subscription.started_at,
      expires_at: subscription.expires_at,
      status: subscription.status,
    },
    { status: 201 }
  );
}
