/**
 * POST /api/routes-f/subscriptions
 * Subscribe a user to a creator for a given tier.
 * Uses in-memory storage (mock) — no real DB.
 *
 * Requires an authenticated session and an `Idempotency-Key` header; retries
 * with the same key replay the original response (see docs/idempotency.md).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { verifySession } from "@/lib/auth/verify-session";
import {
  executeIdempotent,
  IDEMPOTENT_OPERATIONS,
} from "@/lib/idempotency/execute";
import { TIERS } from "@/lib/subscriptions/tiers";

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
  expiry_alert_sent_at?: string; // Track when expiry notification was sent
  renewal_count: number; // Track renewal attempts
  idempotency_ref?: string; // Idempotency record that created this row
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

function findByPaymentTxHash(txHash: string): Subscription | undefined {
  for (const sub of subscriptions.values()) {
    if (sub.payment_tx_hash === txHash) {
      return sub;
    }
  }
  return undefined;
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
    return NextResponse.json(
      { error: "subscription_id is required" },
      { status: 400 }
    );
  }

  const sub = subscriptions.get(subscriptionId);
  if (!sub) {
    return NextResponse.json(
      { error: "Subscription not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(sub);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, createSubscriptionSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  if (bodyResult.data.subscriber_id !== session.userId) {
    return NextResponse.json(
      { error: "subscriber_id must match the authenticated user" },
      { status: 403 }
    );
  }

  return executeIdempotent(
    req,
    {
      userId: session.userId,
      ...IDEMPOTENT_OPERATIONS.subscriptionCreate,
      request: bodyResult.data,
    },
    ({ idempotencyRef }) => createSubscription(bodyResult.data, idempotencyRef)
  );
}

function subscriptionResponse(subscription: Subscription): NextResponse {
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

async function createSubscription(
  data: z.infer<typeof createSubscriptionSchema>,
  idempotencyRef: string
): Promise<NextResponse> {
  const { subscriber_id, creator_id, tier_id, payment_tx_hash, asset } = data;

  // A retry that took over a crashed attempt returns what that attempt made.
  for (const sub of subscriptions.values()) {
    if (sub.idempotency_ref === idempotencyRef) {
      return subscriptionResponse(sub);
    }
  }

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

  // One payment can only ever buy one subscription.
  if (findByPaymentTxHash(payment_tx_hash)) {
    return NextResponse.json(
      {
        error: "Payment already used",
        message:
          "This payment_tx_hash has already been applied to a subscription.",
      },
      { status: 409 }
    );
  }

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
    renewal_count: 0,
    idempotency_ref: idempotencyRef,
  };

  subscriptions.set(subscription.subscription_id, subscription);

  return subscriptionResponse(subscription);
}
