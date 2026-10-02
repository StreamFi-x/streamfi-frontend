export interface Cancellation {
  id: string;
  creator_id: string;
  cancelled_at: string;
  reason: string;
}

export const seedCancellations: Cancellation[] = [
  {
    id: 'cancel_1',
    creator_id: 'creator_001',
    cancelled_at: '2026-07-20T10:30:00Z',
    reason: 'too_expensive',
  },
  {
    id: 'cancel_2',
    creator_id: 'creator_001',
    cancelled_at: '2026-07-19T14:15:00Z',
    reason: 'no_longer_watching',
  },
  {
    id: 'cancel_3',
    creator_id: 'creator_001',
    cancelled_at: '2026-07-18T08:45:00Z',
    reason: 'technical_issues',
  },
  {
    id: 'cancel_4',
    creator_id: 'creator_001',
    cancelled_at: '2026-07-17T16:20:00Z',
    reason: 'too_expensive',
  },
  {
    id: 'cancel_5',
    creator_id: 'creator_001',
    cancelled_at: '2026-07-16T12:00:00Z',
    reason: 'found_alternative',
  },
  {
    id: 'cancel_6',
    creator_id: 'creator_001',
    cancelled_at: '2026-07-15T09:30:00Z',
    reason: 'no_longer_watching',
  },
  {
    id: 'cancel_7',
    creator_id: 'creator_001',
    cancelled_at: '2026-07-14T15:45:00Z',
    reason: 'too_expensive',
  },
  {
    id: 'cancel_8',
    creator_id: 'creator_001',
    cancelled_at: '2026-07-13T11:15:00Z',
    reason: 'other',
  },
  {
    id: 'cancel_9',
    creator_id: 'creator_001',
    cancelled_at: '2026-07-12T13:00:00Z',
    reason: 'technical_issues',
  },
  {
    id: 'cancel_10',
    creator_id: 'creator_001',
    cancelled_at: '2026-07-05T10:00:00Z',
    reason: 'no_longer_watching',
  },
];

export function getSubscriberMetrics(creatorId: string, windowDays: number) {
  const now = new Date('2026-07-25T00:00:00Z');
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const cancellationsInWindow = seedCancellations.filter((c) => {
    if (c.creator_id !== creatorId) {return false;}
    const cancelledDate = new Date(c.cancelled_at);
    return cancelledDate >= windowStart && cancelledDate <= now;
  });

  const reasonCounts: Record<string, number> = {};
  cancellationsInWindow.forEach((c) => {
    reasonCounts[c.reason] = (reasonCounts[c.reason] || 0) + 1;
  });

  const totalSubscribers = 100;
  const churnedCount = cancellationsInWindow.length;
  const churnRate = (churnedCount / totalSubscribers) * 100;

  return {
    churn_rate_percent: Number(churnRate.toFixed(2)),
    cancellation_reasons: reasonCounts,
  };
}
