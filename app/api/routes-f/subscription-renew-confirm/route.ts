/**
 * POST /api/routes-f/subscription-renew-confirm
 *
 * Complete the renewal: create new subscription record extending the existing one
 * Body: { subscription_id: string, payment_tx_hash: string }
 *
 * Requires an authenticated session and an `Idempotency-Key` header; retries
 * with the same key replay the original response (see docs/idempotency.md).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { subscriptions, Subscription } from '../subscriptions/route';
import { verifySession } from '@/lib/auth/verify-session';
import {
  executeIdempotent,
  IDEMPOTENT_OPERATIONS,
} from '@/lib/idempotency/execute';
import { TIERS } from '@/lib/subscriptions/tiers';
import { logger } from '@/lib/tracing/logger';
import { withTracing } from '@/lib/tracing/api-route-wrapper';
import { getCurrentTraceContext } from '@/lib/tracing/trace-context';

const bodySchema = z.object({
  subscription_id: z.string().uuid(),
  payment_tx_hash: z.string().min(1),
});

function generateId(): string {
  return crypto.randomUUID();
}

const handler = async (req: NextRequest): Promise<NextResponse> => {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logger.warn('Invalid JSON in renewal confirmation');
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const validation = bodySchema.safeParse(body);
  if (!validation.success) {
    logger.warn('Renewal confirmation validation failed', {
      errors: validation.error.issues.map(i => i.path.join('.')),
    });
    return NextResponse.json(
      { error: 'subscription_id and payment_tx_hash are required' },
      { status: 400 }
    );
  }

  const { subscription_id, payment_tx_hash } = validation.data;

  logger.info('Processing subscription renewal confirmation', {
    operation: 'subscription-renew-confirm',
    subscriptionId: subscription_id,
  });

  // Look up existing subscription
  const existing = subscriptions.get(subscription_id);
  if (!existing || existing.subscriber_id !== session.userId) {
    logger.warn('Subscription not found for renewal confirmation', {
      subscriptionId: subscription_id,
    });
    return NextResponse.json(
      { error: 'Subscription not found' },
      { status: 404 }
    );
  }

  return executeIdempotent(
    req,
    {
      userId: session.userId,
      ...IDEMPOTENT_OPERATIONS.subscriptionRenew,
      request: validation.data,
    },
    ({ idempotencyRef }) =>
      renewSubscription(existing, payment_tx_hash, idempotencyRef)
  );
};

function renewalResponse(
  renewed: Subscription,
  previousId: string
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      new_subscription_id: renewed.subscription_id,
      previous_subscription_id: previousId,
      started_at: renewed.started_at,
      expires_at: renewed.expires_at,
      renewal_count: renewed.renewal_count,
    },
    { status: 201 }
  );
}

async function renewSubscription(
  existing: Subscription,
  payment_tx_hash: string,
  idempotencyRef: string
): Promise<NextResponse> {
  const subscription_id = existing.subscription_id;

  for (const sub of subscriptions.values()) {
    // A retry that took over a crashed attempt returns what that attempt made.
    if (sub.idempotency_ref === idempotencyRef) {
      return renewalResponse(sub, subscription_id);
    }
    if (sub.payment_tx_hash === payment_tx_hash) {
      return NextResponse.json(
        { error: 'Payment already used' },
        { status: 409 }
      );
    }
  }

  if (existing.status === 'cancelled') {
    return NextResponse.json(
      { error: 'Subscription was already renewed or cancelled' },
      { status: 409 }
    );
  }

  // Get tier duration
  const tier = TIERS[existing.tier_id];
  if (!tier) {
    logger.error('Invalid tier in existing subscription', {
      subscriptionId: subscription_id,
      tierId: existing.tier_id,
    });
    return NextResponse.json(
      { error: 'Subscription tier not found' },
      { status: 500 }
    );
  }

  const now = Date.now();

  // Create new subscription record (or extend existing)
  // In production, this would update the database with a new subscription period
  const newSubscription: Subscription = {
    subscription_id: generateId(),
    subscriber_id: existing.subscriber_id,
    creator_id: existing.creator_id,
    tier_id: existing.tier_id,
    payment_tx_hash,
    asset: existing.asset,
    started_at: new Date(now).toISOString(),
    expires_at: new Date(now + tier.durationDays * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    renewal_count: (existing.renewal_count || 0) + 1,
    idempotency_ref: idempotencyRef,
  };

  subscriptions.set(newSubscription.subscription_id, newSubscription);

  // Update old subscription to mark it as renewed
  existing.status = 'cancelled';
  existing.expiry_alert_sent_at = new Date(now).toISOString();
  subscriptions.set(existing.subscription_id, existing);

  logger.info('Subscription renewed successfully', {
    operation: 'subscription-renew-confirm',
    previousSubscriptionId: subscription_id,
    newSubscriptionId: newSubscription.subscription_id,
    renewalCount: newSubscription.renewal_count,
  });

  return renewalResponse(newSubscription, subscription_id);
}

export const POST = withTracing(handler);
