export interface SubscriptionPerkDefinition {
  tierId: string;
  tierName: string;
  badgeUrl: string;
  allowedEmoteCodes: string[];
  adFreeViewing: boolean;
  subscriberOnlyChat: boolean;
}

export interface UserSubscriptionStatus {
  userId: string;
  channelId: string;
  tierId: string;
  status: 'active' | 'cancelled_paid_through' | 'expired';
  currentPeriodEnd: string;
}

export interface EmoteCheckResult {
  allowed: boolean;
  reason?: string;
  renderedHtml?: string;
}

/**
 * Validates whether a user is entitled to use an exclusive subscriber emote.
 */
export function validateEmoteEntitlement(
  emoteCode: string,
  userSub: UserSubscriptionStatus | null,
  tierConfig: SubscriptionPerkDefinition
): EmoteCheckResult {
  // Global / public emotes
  if (!emoteCode.startsWith(':sub_')) {
    return { allowed: true, renderedHtml: `<span class="emote-public">${emoteCode}</span>` };
  }

  if (!userSub) {
    return {
      allowed: false,
      reason: 'Subscriber-only emote requires an active channel subscription.',
    };
  }

  // Grace / paid-through period check
  const isPaidThrough = new Date(userSub.currentPeriodEnd).getTime() > Date.now();
  if (userSub.status === 'expired' || !isPaidThrough) {
    return {
      allowed: false,
      reason: 'Subscription has expired.',
    };
  }

  if (!tierConfig.allowedEmoteCodes.includes(emoteCode)) {
    return {
      allowed: false,
      reason: `Emote ${emoteCode} requires higher subscription tier (${tierConfig.tierName}).`,
    };
  }

  return {
    allowed: true,
    renderedHtml: `<span class="subscriber-emote" data-emote="${emoteCode}">${emoteCode}</span>`,
  };
}

/**
 * Resolves chat badge metadata for active subscribers.
 */
export function resolveChatBadge(
  userSub: UserSubscriptionStatus | null,
  tierConfig: SubscriptionPerkDefinition
): { badgeUrl: string; label: string } | null {
  if (!userSub) return null;

  const isPaidThrough = new Date(userSub.currentPeriodEnd).getTime() > Date.now();
  if (userSub.status === 'expired' || !isPaidThrough) {
    return null;
  }

  return {
    badgeUrl: tierConfig.badgeUrl,
    label: `${tierConfig.tierName} Subscriber`,
  };
}
