import type { PrivyUserEventData } from "./types";

/**
 * In-memory mock of the user records touched by Privy lifecycle events.
 * A real deployment would upsert into the `users` table (keyed by
 * `privy_id`); this route folder is self-contained per the routes-f
 * convention (see stream-quiz-create, stream-prediction-create, etc.),
 * so it tracks processed events with a lightweight in-memory store.
 */
export interface StoredPrivyUser {
  privy_id: string;
  wallet_address: string | null;
  email: string | null;
  updated_at: string;
}

export const privyUsers = new Map<string, StoredPrivyUser>();

// Tracks processed svix event ids for idempotency (Privy/svix may redeliver
// the same event more than once).
export const processedEventIds = new Set<string>();

export function upsertPrivyUser(data: PrivyUserEventData): StoredPrivyUser {
  const existing = privyUsers.get(data.id);
  const wallet =
    data.wallet?.address ??
    data.linked_accounts?.find((a) => a.type === "wallet")?.address ??
    existing?.wallet_address ??
    null;
  const email =
    data.email?.address ??
    data.linked_accounts?.find((a) => a.type === "email")?.email ??
    existing?.email ??
    null;

  const record: StoredPrivyUser = {
    privy_id: data.id,
    wallet_address: wallet,
    email,
    updated_at: new Date().toISOString(),
  };

  privyUsers.set(data.id, record);
  return record;
}
