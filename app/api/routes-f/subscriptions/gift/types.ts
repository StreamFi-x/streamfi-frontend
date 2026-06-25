export interface GiftSubscriptionBody {
  gifter_id: string;
  recipient_id: string;
  creator_id: string;
  tier_id: string;
  payment_tx_hash: string;
}

export interface GiftRecord {
  gift_id: string;
  gifter_id: string;
  recipient_id: string;
  creator_id: string;
  tier_id: string;
  payment_tx_hash: string;
  created_at: string; // ISO timestamp
}

export interface SubscriptionRecord {
  subscription_id: string;
  subscriber_id: string; // recipient owns the sub
  creator_id: string;
  tier_id: string;
  started_at: string; // ISO timestamp
  gifted_by: string; // gifter_id
  gift_id: string;
}

export interface InboxNotification {
  notification_id: string;
  user_id: string;
  type: "gift_subscription";
  message: string;
  gift_id: string;
  read: boolean;
  created_at: string;
}

export interface GiftResponse {
  gift_id: string;
}
