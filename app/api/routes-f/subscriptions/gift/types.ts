export interface GiftSubscriptionBody {
  gifter_id: string;
  recipient_id?: string; // Optional if is_bulk is true
  creator_id: string;
  tier_id: string;
  payment_tx_hash: string;
  is_bulk?: boolean;
  bulk_count?: number; // 1 to 50
  recipients?: string[]; // explicit recipients for bulk or chosen from active community
}

export interface GiftRecord {
  gift_id: string;
  gifter_id: string;
  recipient_id: string;
  creator_id: string;
  tier_id: string;
  payment_tx_hash: string;
  is_stacked?: boolean;
  created_at: string; // ISO timestamp
}

export interface SubscriptionRecord {
  subscription_id: string;
  subscriber_id: string; // recipient owns the sub
  creator_id: string;
  tier_id: string;
  started_at: string; // ISO timestamp
  expires_at: string; // ISO timestamp
  status: "active" | "expired";
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

export interface ChatGiftEvent {
  event_id: string;
  type: "chat_gift_announcement";
  channel_id: string;
  gifter_id: string;
  recipient_id: string;
  tier_id: string;
  message: string;
  is_bulk: boolean;
  bulk_count?: number;
  timestamp: string;
}

export interface GiftResponse {
  gift_id: string;
  recipient_id: string;
  is_stacked: boolean;
  expires_at: string;
  bulk_gifts?: { gift_id: string; recipient_id: string; expires_at: string }[];
}
