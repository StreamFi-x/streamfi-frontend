import type { SubscriptionRecord } from "./types";

// Deterministic seed subscriptions — fixed far-future/far-past expiry dates
// so "active" filtering is stable regardless of when the test runs.
export const subscriptionRecordStore: SubscriptionRecord[] = [
  {
    subscription_id: "sub_1",
    subscriber_id: "viewer-1",
    creator_id: "creator-alpha",
    creator_name: "AlphaStreams",
    tier_id: "tier_alpha_basic",
    tier_name: "Basic",
    status: "active",
    started_at: "2026-01-01T00:00:00.000Z",
    expires_at: "2099-01-01T00:00:00.000Z",
  },
  {
    subscription_id: "sub_2",
    subscriber_id: "viewer-1",
    creator_id: "creator-gamma",
    creator_name: "GammaGaming",
    tier_id: "tier_gamma_premium",
    tier_name: "Premium",
    status: "active",
    started_at: "2026-02-01T00:00:00.000Z",
    expires_at: "2099-01-01T00:00:00.000Z",
  },
  {
    subscription_id: "sub_3",
    subscriber_id: "viewer-1",
    creator_id: "creator-delta",
    creator_name: "DeltaBeats",
    tier_id: "tier_delta_basic",
    tier_name: "Basic",
    // Status says active, but the expiry date has already passed — this
    // should still be excluded from "active" results.
    status: "active",
    started_at: "2019-01-01T00:00:00.000Z",
    expires_at: "2020-01-01T00:00:00.000Z",
  },
  {
    subscription_id: "sub_4",
    subscriber_id: "viewer-1",
    creator_id: "creator-epsilon",
    creator_name: "EpsilonESports",
    tier_id: "tier_epsilon_basic",
    tier_name: "Basic",
    status: "cancelled",
    started_at: "2026-01-01T00:00:00.000Z",
    expires_at: "2099-01-01T00:00:00.000Z",
  },
];

export function getSubscriptionsForSubscriber(
  subscriberId: string
): SubscriptionRecord[] {
  return subscriptionRecordStore.filter(s => s.subscriber_id === subscriberId);
}
