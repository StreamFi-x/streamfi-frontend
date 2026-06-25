import type { GiftRecord, SubscriptionRecord, InboxNotification } from "./types";

let giftCounter = 1;
let subCounter = 1;
let notifCounter = 1;

export const giftStore: GiftRecord[] = [];
export const subscriptionStore: SubscriptionRecord[] = [];
export const inboxStore: InboxNotification[] = [];

// Known users — any ID not in this list is treated as new
export const knownUsers = new Set<string>([
  "user_alice",
  "user_bob",
  "user_charlie",
  "user_diana",
  "user_eve",
  "creator_a",
  "creator_b",
  "creator_c",
]);

// Valid subscription tiers per creator
export const validTiers: Record<string, string[]> = {
  creator_a: ["tier_bronze", "tier_silver", "tier_gold"],
  creator_b: ["tier_basic", "tier_pro", "tier_whale"],
  creator_c: ["tier_1", "tier_2", "tier_3"],
};

export function createGift(
  gifterId: string,
  recipientId: string,
  creatorId: string,
  tierId: string,
  txHash: string
): { gift: GiftRecord; subscription: SubscriptionRecord; notification: InboxNotification } {
  const now = new Date().toISOString();

  const gift: GiftRecord = {
    gift_id: `gift_${String(giftCounter++).padStart(4, "0")}`,
    gifter_id: gifterId,
    recipient_id: recipientId,
    creator_id: creatorId,
    tier_id: tierId,
    payment_tx_hash: txHash,
    created_at: now,
  };

  const subscription: SubscriptionRecord = {
    subscription_id: `sub_${String(subCounter++).padStart(4, "0")}`,
    subscriber_id: recipientId,
    creator_id: creatorId,
    tier_id: tierId,
    started_at: now,
    gifted_by: gifterId,
    gift_id: gift.gift_id,
  };

  const notification: InboxNotification = {
    notification_id: `notif_${String(notifCounter++).padStart(4, "0")}`,
    user_id: recipientId,
    type: "gift_subscription",
    message: `${gifterId} gifted you a ${tierId} subscription to ${creatorId}!`,
    gift_id: gift.gift_id,
    read: false,
    created_at: now,
  };

  giftStore.push(gift);
  subscriptionStore.push(subscription);
  inboxStore.push(notification);

  // Add recipient to known users if they didn't exist
  knownUsers.add(recipientId);

  return { gift, subscription, notification };
}

export function getInboxForUser(userId: string): InboxNotification[] {
  return inboxStore.filter(n => n.user_id === userId);
}
