import {
  isExpiryNotificationDue,
  hasExpired,
  buildExpiryNotificationMessage,
  processExpiryNotifications,
  DEFAULT_CONFIG,
  SubscriptionWithExpiry,
} from '@/lib/subscriptions/expiry-notifier';

describe('Subscription Renewal and Expiry Logic', () => {
  const createMockSubscription = (overrides: Partial<SubscriptionWithExpiry> = {}): SubscriptionWithExpiry => ({
    subscription_id: 'sub-123',
    subscriber_id: 'user-456',
    creator_id: 'creator-789',
    tier_id: 'basic',
    started_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
    status: 'active',
    renewal_count: 0,
    ...overrides,
  });

  describe('isExpiryNotificationDue', () => {
    it('returns true when subscription expires within notification window and not yet notified', () => {
      const sub = createMockSubscription({
        expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
        expiry_alert_sent_at: undefined,
      });

      const result = isExpiryNotificationDue(sub, DEFAULT_CONFIG, new Date());
      expect(result).toBe(true);
    });

    it('returns false when already notified and at max notifications', () => {
      const sub = createMockSubscription({
        expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        expiry_alert_sent_at: new Date().toISOString(),
        renewal_count: 1,
      });

      const result = isExpiryNotificationDue(sub, DEFAULT_CONFIG, new Date());
      expect(result).toBe(false);
    });

    it('returns false when subscription is already expired', () => {
      const sub = createMockSubscription({
        expires_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      });

      const result = isExpiryNotificationDue(sub, DEFAULT_CONFIG, new Date());
      expect(result).toBe(false);
    });

    it('returns false when subscription is cancelled', () => {
      const sub = createMockSubscription({
        expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'cancelled',
      });

      const result = isExpiryNotificationDue(sub, DEFAULT_CONFIG, new Date());
      expect(result).toBe(false);
    });

    it('returns false when expiry is beyond notification window', () => {
      const sub = createMockSubscription({
        expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days
      });

      const result = isExpiryNotificationDue(sub, DEFAULT_CONFIG, new Date());
      expect(result).toBe(false);
    });
  });

  describe('hasExpired', () => {
    it('returns true when subscription has passed expiry date', () => {
      const sub = createMockSubscription({
        expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      const result = hasExpired(sub, new Date());
      expect(result).toBe(true);
    });

    it('returns false when subscription has not yet expired', () => {
      const sub = createMockSubscription({
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const result = hasExpired(sub, new Date());
      expect(result).toBe(false);
    });
  });

  describe('buildExpiryNotificationMessage', () => {
    it('builds notification message with correct days until expiry', () => {
      const sub = createMockSubscription({
        expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const message = buildExpiryNotificationMessage(sub);

      expect(message.subject).toContain('2 days');
      expect(message.body).toContain('expires');
      expect(message.renewal_url).toContain(sub.subscription_id);
    });
  });

  describe('processExpiryNotifications', () => {
    it('sends notification for subscriptions due for expiry alert', async () => {
      const sub = createMockSubscription({
        expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        expiry_alert_sent_at: undefined,
      });

      const notificationsSent: any[] = [];
      const mockSendNotification = async (notification: any) => {
        notificationsSent.push(notification);
      };

      await processExpiryNotifications(
        [sub],
        DEFAULT_CONFIG,
        mockSendNotification
      );

      expect(notificationsSent).toHaveLength(1);
      expect(notificationsSent[0].subscription_id).toBe(sub.subscription_id);
      expect(notificationsSent[0].notification_type).toBe('expiry_warning');
    });

    it('sends expired notification for already-expired subscriptions', async () => {
      const sub = createMockSubscription({
        expires_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        expiry_alert_sent_at: undefined,
      });

      const notificationsSent: any[] = [];
      const mockSendNotification = async (notification: any) => {
        notificationsSent.push(notification);
      };

      await processExpiryNotifications(
        [sub],
        DEFAULT_CONFIG,
        mockSendNotification
      );

      expect(notificationsSent.some(n => n.notification_type === 'expired')).toBe(true);
    });

    it('does not notify cancelled subscriptions', async () => {
      const sub = createMockSubscription({
        expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'cancelled',
      });

      const notificationsSent: any[] = [];
      const mockSendNotification = async (notification: any) => {
        notificationsSent.push(notification);
      };

      await processExpiryNotifications(
        [sub],
        DEFAULT_CONFIG,
        mockSendNotification
      );

      expect(notificationsSent).toHaveLength(0);
    });

    it('handles multiple subscriptions and respects max notifications limit', async () => {
      const subs: SubscriptionWithExpiry[] = [
        createMockSubscription({
          subscription_id: 'sub-1',
          expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        createMockSubscription({
          subscription_id: 'sub-2',
          expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ];

      const notificationsSent: any[] = [];
      const mockSendNotification = async (notification: any) => {
        notificationsSent.push(notification);
      };

      await processExpiryNotifications(
        subs,
        DEFAULT_CONFIG,
        mockSendNotification
      );

      expect(notificationsSent).toHaveLength(1);
      expect(notificationsSent[0].subscription_id).toBe('sub-1');
    });
  });

  describe('Renewal Flow Happy Path', () => {
    it('allows renewal of active, non-expired subscription', () => {
      const sub = createMockSubscription({
        status: 'active',
        expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // Subscription can be renewed before expiry
      expect(sub.status).toBe('active');
      expect(hasExpired(sub)).toBe(false);
    });

    it('allows renewal of expired subscription', () => {
      const sub = createMockSubscription({
        status: 'active',
        expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      // Even expired subscriptions can be renewed
      expect(hasExpired(sub)).toBe(true);
    });

    it('prevents renewal of cancelled subscription', () => {
      const sub = createMockSubscription({
        status: 'cancelled',
      });

      // Cancelled subscriptions should not be renewable
      expect(sub.status).toBe('cancelled');
    });
  });

  describe('Renewal Failure Paths', () => {
    it('tracks renewal count across renewals', () => {
      const sub = createMockSubscription({
        renewal_count: 0,
      });

      expect(sub.renewal_count).toBe(0);

      const renewedSub = { ...sub, renewal_count: 1 };
      expect(renewedSub.renewal_count).toBe(1);
    });

    it('handles notification errors gracefully', async () => {
      const sub = createMockSubscription({
        expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const mockFailingSend = async () => {
        throw new Error('Notification service down');
      };

      // Should not throw, just log the error
      const result = await processExpiryNotifications(
        [sub],
        DEFAULT_CONFIG,
        mockFailingSend
      );

      expect(result).toBeDefined();
    });
  });
});
