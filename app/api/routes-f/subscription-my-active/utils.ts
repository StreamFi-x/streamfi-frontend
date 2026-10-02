import type { SubscriptionRecord, ActiveSubscriptionEntry } from "./types";

export function isActive(sub: SubscriptionRecord, now: number = Date.now()): boolean {
  return sub.status === "active" && new Date(sub.expires_at).getTime() > now;
}

export function toActiveEntry(sub: SubscriptionRecord): ActiveSubscriptionEntry {
  const {
    subscription_id,
    creator_id,
    creator_name,
    tier_id,
    tier_name,
    started_at,
    expires_at,
  } = sub;
  return {
    subscription_id,
    creator_id,
    creator_name,
    tier_id,
    tier_name,
    started_at,
    expires_at,
  };
}

export function filterActiveSubscriptions(
  subs: SubscriptionRecord[],
  now: number = Date.now()
): ActiveSubscriptionEntry[] {
  return subs.filter(sub => isActive(sub, now)).map(toActiveEntry);
}
