/**
 * POST /api/routes-f/subscription-renew-confirm
 *
 * Complete the renewal: create new subscription record extending the existing one
 * Body: { subscription_id: string, payment_tx_hash: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { subscriptions, Subscription, TIERS } from '../subscriptions/route';
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
  if (!existing) {
    logger.warn('Subscription not found for renewal confirmation', {
      subscriptionId: subscription_id,
    });
    return NextResponse.json(
      { error: 'Subscription not found' },
      { status: 404 }
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

  return NextResponse.json(
    {
      success: true,
      new_subscription_id: newSubscription.subscription_id,
      previous_subscription_id: subscription_id,
      started_at: newSubscription.started_at,
      expires_at: newSubscription.expires_at,
      renewal_count: newSubscription.renewal_count,
    },
    { status: 201 }
  );
};

export const POST = withTracing(handler);
