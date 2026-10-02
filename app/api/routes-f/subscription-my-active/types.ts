export type SubscriptionRecordStatus = "active" | "cancelled" | "expired";

export interface SubscriptionRecord {
  subscription_id: string;
  subscriber_id: string;
  creator_id: string;
  creator_name: string;
  tier_id: string;
  tier_name: string;
  status: SubscriptionRecordStatus;
  started_at: string;
  expires_at: string;
}

export interface ActiveSubscriptionEntry {
  subscription_id: string;
  creator_id: string;
  creator_name: string;
  tier_id: string;
  tier_name: string;
  started_at: string;
  expires_at: string;
}

export interface MyActiveSubscriptionsResponse {
  subscriptions: ActiveSubscriptionEntry[];
}
