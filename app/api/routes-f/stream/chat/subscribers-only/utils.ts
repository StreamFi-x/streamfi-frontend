import type { SubscribersOnlyData } from "./types";

export const subscribersOnlyStore = new Map<string, SubscribersOnlyData>();

export function getSubscribersOnlyState(
  streamId: string
): SubscribersOnlyData | undefined {
  return subscribersOnlyStore.get(streamId);
}

export function setSubscribersOnlyRestriction(
  streamId: string,
  tierId?: string
): SubscribersOnlyData {
  const data: SubscribersOnlyData = {
    enabled: true,
    tier_id: tierId,
  };
  subscribersOnlyStore.set(streamId, data);
  return data;
}

export function disableSubscribersOnlyRestriction(streamId: string): void {
  subscribersOnlyStore.delete(streamId);
}

export function validateTierId(tierId: string | undefined): {
  valid: boolean;
  error?: string;
} {
  if (tierId === undefined) {
    return { valid: true };
  }

  if (typeof tierId !== "string") {
    return { valid: false, error: "tier_id must be a string" };
  }

  if (tierId.trim().length === 0) {
    return {
      valid: false,
      error: "tier_id must not be empty",
    };
  }

  if (tierId.length > 100) {
    return {
      valid: false,
      error: "tier_id must be 100 characters or less",
    };
  }

  return { valid: true };
}
