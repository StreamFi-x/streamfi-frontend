import type { GiftRecord, SubscriptionRecord, InboxNotification, ChatGiftEvent } from "./types";

let giftCounter = 1;
let subCounter = 1;
let notifCounter = 1;
let chatEventCounter = 1;

export const giftStore: GiftRecord[] = [];
export const subscriptionStore: SubscriptionRecord[] = [];
export const inboxStore: InboxNotification[] = [];
export const chatGiftEventsStore: ChatGiftEvent[] = [];

// Composite key lookup: `${subscriber_id}:${creator_id}` -> SubscriptionRecord
export const activeSubscriptionMap = new Map<string, SubscriptionRecord>();

// Known users — any ID not in this list is treated as new
export const knownUsers = new Set<string>([
  "user_alice",
  "user_bob",
  "user_charlie",
  "user_diana",
  "user_eve",
  "user_frank",
  "user_grace",
  "creator_a",
  "creator_b",
  "creator_c",
]);

// Valid subscription tiers per creator with duration in days (default 30 days)
export const validTiers: Record<string, string[]> = {
  creator_a: ["tier_bronze", "tier_silver", "tier_gold"],
  creator_b: ["tier_basic", "tier_pro", "tier_whale"],
  creator_c: ["tier_1", "tier_2", "tier_3"],
};

export const TIER_DURATION_DAYS: Record<string, number> = {
  tier_bronze: 30,
  tier_silver: 30,
  tier_gold: 30,
  tier_basic: 30,
  tier_pro: 30,
  tier_whale: 30,
  tier_1: 30,
  tier_2: 30,
  tier_3: 30,
};

export function resetGiftStore() {
  giftCounter = 1;
  subCounter = 1;
  notifCounter = 1;
  chatEventCounter = 1;
  giftStore.length = 0;
  subscriptionStore.length = 0;
  inboxStore.length = 0;
  chatGiftEventsStore.length = 0;
  activeSubscriptionMap.clear();
  knownUsers.clear();
  [
    "user_alice",
    "user_bob",
    "user_charlie",
    "user_diana",
    "user_eve",
    "user_frank",
    "user_grace",
    "creator_a",
    "creator_b",
    "creator_c",
  ].forEach((u) => knownUsers.add(u));
}

export function getActiveSubscription(subscriberId: string, creatorId: string): SubscriptionRecord | undefined {
  const sub = activeSubscriptionMap.get(`${subscriberId}:${creatorId}`);
  if (!sub) {
    return undefined;
  }
  if (new Date(sub.expires_at).getTime() < Date.now()) {
    sub.status = "expired";
    return undefined;
  }
  return sub;
}

export function createGift(
  gifterId: string,
  recipientId: string,
  creatorId: string,
  tierId: string,
  txHash: string
): {
  gift: GiftRecord;
  subscription: SubscriptionRecord;
  notification: InboxNotification;
  chatEvent: ChatGiftEvent;
  isStacked: boolean;
} {
  const now = new Date();
  const nowIso = now.toISOString();
  const durationDays = TIER_DURATION_DAYS[tierId] ?? 30;
  const durationMs = durationDays * 24 * 60 * 60 * 1000;

  // Check if recipient already has an active subscription for this creator
  const existingSub = getActiveSubscription(recipientId, creatorId);
  let isStacked = false;
  let expiresAt: string;
  let startedAt = nowIso;

  if (existingSub && existingSub.status === "active") {
    // Stack / extend existing subscription duration
    isStacked = true;
    const currentExpiryMs = new Date(existingSub.expires_at).getTime();
    const baseTime = currentExpiryMs > now.getTime() ? currentExpiryMs : now.getTime();
    expiresAt = new Date(baseTime + durationMs).toISOString();
    startedAt = existingSub.started_at;
  } else {
    // New subscription period
    expiresAt = new Date(now.getTime() + durationMs).toISOString();
  }

  const gift: GiftRecord = {
    gift_id: `gift_${String(giftCounter++).padStart(4, "0")}`,
    gifter_id: gifterId,
    recipient_id: recipientId,
    creator_id: creatorId,
    tier_id: tierId,
    payment_tx_hash: txHash,
    is_stacked: isStacked,
    created_at: nowIso,
  };

  const subscription: SubscriptionRecord = {
    subscription_id: existingSub ? existingSub.subscription_id : `sub_${String(subCounter++).padStart(4, "0")}`,
    subscriber_id: recipientId,
    creator_id: creatorId,
    tier_id: tierId,
    started_at: startedAt,
    expires_at: expiresAt,
    status: "active",
    gifted_by: gifterId,
    gift_id: gift.gift_id,
  };

  const notification: InboxNotification = {
    notification_id: `notif_${String(notifCounter++).padStart(4, "0")}`,
    user_id: recipientId,
    type: "gift_subscription",
    message: isStacked
      ? `${gifterId} extended your ${tierId} subscription to ${creatorId} until ${new Date(expiresAt).toLocaleDateString()}!`
      : `${gifterId} gifted you a ${tierId} subscription to ${creatorId}!`,
    gift_id: gift.gift_id,
    read: false,
    created_at: nowIso,
  };

  const chatEvent: ChatGiftEvent = {
    event_id: `chatevt_${String(chatEventCounter++).padStart(4, "0")}`,
    type: "chat_gift_announcement",
    channel_id: creatorId,
    gifter_id: gifterId,
    recipient_id: recipientId,
    tier_id: tierId,
    message: isStacked
      ? `🎉 ${gifterId} extended ${recipientId}'s subscription to ${tierId}!`
      : `🎉 ${gifterId} gifted a Tier ${tierId} subscription to ${recipientId}!`,
    is_bulk: false,
    timestamp: nowIso,
  };

  giftStore.push(gift);
  if (!existingSub) {
    subscriptionStore.push(subscription);
  } else {
    // Update existing subscription record in store
    const idx = subscriptionStore.findIndex((s) => s.subscription_id === subscription.subscription_id);
    if (idx !== -1) {
      subscriptionStore[idx] = subscription;
    }
  }
  activeSubscriptionMap.set(`${recipientId}:${creatorId}`, subscription);
  inboxStore.push(notification);
  chatGiftEventsStore.push(chatEvent);

  knownUsers.add(recipientId);

  return { gift, subscription, notification, chatEvent, isStacked };
}

export function createBulkGifts(
  gifterId: string,
  creatorId: string,
  tierId: string,
  txHash: string,
  count: number,
  explicitRecipients?: string[]
): {
  gifts: GiftRecord[];
  subscriptions: SubscriptionRecord[];
  notifications: InboxNotification[];
  chatEvent: ChatGiftEvent;
} {
  const recipients: string[] = [];

  if (explicitRecipients && explicitRecipients.length > 0) {
    recipients.push(...explicitRecipients.slice(0, count));
  } else {
    // Select from known community members excluding gifter and creator
    const eligible = Array.from(knownUsers).filter((u) => u !== gifterId && u !== creatorId);
    // Shuffle or pick candidates
    for (let i = 0; i < count; i++) {
      if (eligible.length > 0) {
        const picked = eligible[i % eligible.length];
        recipients.push(picked);
      } else {
        recipients.push(`community_viewer_${i + 1}`);
      }
    }
  }

  const gifts: GiftRecord[] = [];
  const subscriptions: SubscriptionRecord[] = [];
  const notifications: InboxNotification[] = [];

  for (const recipient of recipients) {
    const res = createGift(gifterId, recipient, creatorId, tierId, `${txHash}_${recipient}`);
    gifts.push(res.gift);
    subscriptions.push(res.subscription);
    notifications.push(res.notification);
  }

  const nowIso = new Date().toISOString();
  const bulkChatEvent: ChatGiftEvent = {
    event_id: `chatevt_${String(chatEventCounter++).padStart(4, "0")}`,
    type: "chat_gift_announcement",
    channel_id: creatorId,
    gifter_id: gifterId,
    recipient_id: `${count} community members`,
    tier_id: tierId,
    message: `🎁 ${gifterId} gifted ${count} Tier ${tierId} subscriptions to the community!`,
    is_bulk: true,
    bulk_count: count,
    timestamp: nowIso,
  };
  chatGiftEventsStore.push(bulkChatEvent);

  return { gifts, subscriptions, notifications, chatEvent: bulkChatEvent };
}

export function getInboxForUser(userId: string): InboxNotification[] {
  return inboxStore.filter((n) => n.user_id === userId);
}
