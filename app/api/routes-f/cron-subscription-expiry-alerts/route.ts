/**
 * GET /api/routes-f/cron-subscription-expiry-alerts
 *
 * Cron job to send expiry alerts to subscribers whose subscriptions are about to expire
 * Called by external scheduler (e.g., GitHub Actions, Vercel Cron, AWS EventBridge)
 * 
 * Should run daily, ~24h before subscriptions are due to expire
 */
import { NextRequest, NextResponse } from 'next/server';
import { subscriptions } from '../subscriptions/route';
import { logger } from '@/lib/tracing/logger';
import { withTracing } from '@/lib/tracing/api-route-wrapper';
import { 
  processExpiryNotifications,
  DEFAULT_CONFIG,
  SubscriptionWithExpiry,
} from '@/lib/subscriptions/expiry-notifier';

const handler = async (req: NextRequest): Promise<NextResponse> => {
  // Security: verify cron secret if needed
  const cronSecret = req.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    logger.warn('Cron request rejected: invalid secret');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  logger.info('Subscription expiry alert cron job started', {
    operation: 'cron-subscription-expiry-alerts',
  });

  try {
    // Convert subscriptions map to array for processing
    const subscriptionsArray: SubscriptionWithExpiry[] = Array.from(subscriptions.values()) as unknown as SubscriptionWithExpiry[];

    logger.info('Processing subscriptions for expiry alerts', {
      totalSubscriptions: subscriptionsArray.length,
    });

    // Simulate sending notifications (in production, would send emails/push notifications)
    const notifications = await processExpiryNotifications(
      subscriptionsArray,
      DEFAULT_CONFIG,
      async (notification) => {
        logger.info('Sending expiry notification', {
          operation: 'cron-subscription-expiry-alerts',
          notificationType: notification.notification_type,
          subscriberId: notification.subscriber_id,
          subscriptionId: notification.subscription_id,
        });

        // In production, integrate with notification service (SendGrid, AWS SNS, etc.)
        // await notificationService.send({
        //   userId: notification.subscriber_id,
        //   type: notification.notification_type,
        //   data: { ...notification },
        // });

        // Mark subscription as having alert sent
        const sub = subscriptions.get(notification.subscription_id);
        if (sub) {
          sub.expiry_alert_sent_at = notification.sent_at;
          subscriptions.set(notification.subscription_id, sub);
        }
      }
    );

    logger.info('Subscription expiry alert cron job completed', {
      operation: 'cron-subscription-expiry-alerts',
      notificationsSent: notifications.length,
    });

    return NextResponse.json(
      {
        success: true,
        notifications_sent: notifications.length,
        notifications,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Cron job failed', {
      operation: 'cron-subscription-expiry-alerts',
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: 'Cron job failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
};

export const GET = withTracing(handler);
