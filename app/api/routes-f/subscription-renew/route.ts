/**
 * GET /api/routes-f/subscription-renew?subscription_id=XXX
 *
 * One-click renewal flow: retrieve subscription details and pre-populate renewal intent
 * Returns necessary data to trigger a streamlined renewal without re-entering creator/tier info
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { subscriptions } from '../subscriptions/route';
import { logger } from '@/lib/tracing/logger';
import { withTracing } from '@/lib/tracing/api-route-wrapper';

const querySchema = z.object({
  subscription_id: z.string().uuid().optional(),
});

const handler = async (req: NextRequest): Promise<NextResponse> => {
  const { searchParams } = new URL(req.url);
  const subscriptionId = searchParams.get('subscription_id');

  if (!subscriptionId) {
    logger.warn('Renewal request missing subscription_id');
    return NextResponse.json(
      { error: 'subscription_id is required' },
      { status: 400 }
    );
  }

  logger.info('Renewal request received', {
    operation: 'subscription-renew',
    subscriptionId,
  });

  // Look up existing subscription
  const existing = subscriptions.get(subscriptionId);
  if (!existing) {
    logger.warn('Subscription not found for renewal', {
      subscriptionId,
    });
    return NextResponse.json(
      { error: 'Subscription not found' },
      { status: 404 }
    );
  }

  // Check if already expired or cancelled
  const now = Date.now();
  const isExpired = new Date(existing.expires_at).getTime() < now;
  const isCancelled = existing.status === 'cancelled';

  if (isCancelled) {
    logger.warn('Attempted renewal of cancelled subscription', {
      subscriptionId,
    });
    return NextResponse.json(
      { error: 'Subscription is cancelled and cannot be renewed' },
      { status: 400 }
    );
  }

  logger.info('Subscription renewal intent retrieved', {
    subscriptionId,
    creatorId: existing.creator_id,
    tierId: existing.tier_id,
    isExpired,
  });

  // Return pre-populated renewal data
  // Client can use this to skip creator/tier selection and go straight to payment
  return NextResponse.json(
    {
      renewal_intent: {
        subscription_id: existing.subscription_id,
        creator_id: existing.creator_id,
        tier_id: existing.tier_id,
        subscriber_id: existing.subscriber_id,
        last_payment_asset: existing.asset,
        current_expires_at: existing.expires_at,
        is_expired: isExpired,
        renewal_url: `/checkout/subscription-renew?subscription_id=${subscriptionId}`,
      },
    },
    { status: 200 }
  );
};

export const GET = withTracing(handler);
