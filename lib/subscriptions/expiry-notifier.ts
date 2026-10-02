import { logger } from '@/lib/tracing/logger';
import { getCurrentTraceContext } from '@/lib/tracing/trace-context';

/**
 * Configuration for subscription expiry notifications
 */
export interface ExpiryNotificationConfig {
  daysBeforeExpiry: number; // e.g., 3 = notify 3 days before expiry
  maxNotificationsPerSubscription: number; // e.g., 1 = only notify once
}

export const DEFAULT_CONFIG: ExpiryNotificationConfig = {
  daysBeforeExpiry: 3,
  maxNotificationsPerSubscription: 1,
};

/**
 * Subscription record with expiry tracking
 */
export interface SubscriptionWithExpiry {
  subscription_id: string;
  subscriber_id: string;
  creator_id: string;
  tier_id: string;
  expires_at: string;
  started_at: string;
  expiry_alert_sent_at?: string;
  renewal_count: number;
  status: 'active' | 'cancelled';
}

/**
 * Notification record
 */
export interface ExpiryNotification {
  subscription_id: string;
  subscriber_id: string;
  creator_id: string;
  expires_at: string;
  notification_type: 'expiry_warning' | 'expired';
  sent_at: string;
}

/**
 * Check if a subscription is approaching expiry and notification should be sent
 */
export function isExpiryNotificationDue(
  subscription: SubscriptionWithExpiry,
  config: ExpiryNotificationConfig = DEFAULT_CONFIG,
  now: Date = new Date()
): boolean {
  // Don't notify cancelled subscriptions
  if (subscription.status === 'cancelled') {
    return false;
  }

  // Don't re-notify if already sent and at max
  if (subscription.expiry_alert_sent_at && subscription.renewal_count >= config.maxNotificationsPerSubscription) {
    return false;
  }

  const expiryDate = new Date(subscription.expires_at);
  const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  // Notify if within the threshold days and hasn't been notified yet
  return daysUntilExpiry <= config.daysBeforeExpiry && daysUntilExpiry > 0 && !subscription.expiry_alert_sent_at;
}

/**
 * Check if a subscription has expired
 */
export function hasExpired(
  subscription: SubscriptionWithExpiry,
  now: Date = new Date()
): boolean {
  const expiryDate = new Date(subscription.expires_at);
  return expiryDate.getTime() < now.getTime();
}

/**
 * Build notification message for expiry alert
 */
export function buildExpiryNotificationMessage(
  subscription: SubscriptionWithExpiry,
  config: ExpiryNotificationConfig = DEFAULT_CONFIG
): { subject: string; body: string; renewal_url: string } {
  const expiryDate = new Date(subscription.expires_at);
  const daysUntilExpiry = Math.ceil(
    (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return {
    subject: `Your subscription expires in ${daysUntilExpiry} days`,
    body: `Your subscription to creator ${subscription.creator_id} expires on ${expiryDate.toLocaleDateString()}. Click below to renew and maintain access.`,
    renewal_url: `/api/routes-f/subscription-renew?subscription_id=${subscription.subscription_id}`,
  };
}

/**
 * Simulate processing subscription expiry notifications
 * In production, this would be called by a cron job
 */
export async function processExpiryNotifications(
  subscriptions: SubscriptionWithExpiry[],
  config: ExpiryNotificationConfig = DEFAULT_CONFIG,
  sendNotification: (notification: ExpiryNotification) => Promise<void> = async () => {}
): Promise<ExpiryNotification[]> {
  const now = new Date();
  const traceContext = getCurrentTraceContext();

  logger.info('Processing subscription expiry notifications', {
    operation: 'processExpiryNotifications',
    subscriptionCount: subscriptions.length,
    config,
  });

  const notifications: ExpiryNotification[] = [];

  for (const subscription of subscriptions) {
    try {
      if (isExpiryNotificationDue(subscription, config, now)) {
        const notification: ExpiryNotification = {
          subscription_id: subscription.subscription_id,
          subscriber_id: subscription.subscriber_id,
          creator_id: subscription.creator_id,
          expires_at: subscription.expires_at,
          notification_type: 'expiry_warning',
          sent_at: now.toISOString(),
        };

        await sendNotification(notification);

        notifications.push(notification);

        logger.info('Expiry notification sent', {
          operation: 'processExpiryNotifications',
          subscriptionId: subscription.subscription_id,
          subscriberId: subscription.subscriber_id,
        });
      }

      // Check if already expired and send expiry notification
      if (hasExpired(subscription, now) && !subscription.expiry_alert_sent_at) {
        const notification: ExpiryNotification = {
          subscription_id: subscription.subscription_id,
          subscriber_id: subscription.subscriber_id,
          creator_id: subscription.creator_id,
          expires_at: subscription.expires_at,
          notification_type: 'expired',
          sent_at: now.toISOString(),
        };

        await sendNotification(notification);
        notifications.push(notification);

        logger.warn('Subscription expired notification sent', {
          operation: 'processExpiryNotifications',
          subscriptionId: subscription.subscription_id,
        });
      }
    } catch (error) {
      logger.error('Failed to process expiry notification', {
        operation: 'processExpiryNotifications',
        subscriptionId: subscription.subscription_id,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('Expiry notification processing completed', {
    operation: 'processExpiryNotifications',
    notificationsCount: notifications.length,
  });

  return notifications;
}
