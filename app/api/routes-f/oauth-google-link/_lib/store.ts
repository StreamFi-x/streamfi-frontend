import type { GoogleLinkRecord, LinkResult } from "./types";

// Keyed by google_id → link record. A Google identity can only ever point
// at one user_id at a time, so this map alone is enough to detect conflicts.
const linksByGoogleId = new Map<string, GoogleLinkRecord>();

// Keyed by user_id → google_id, so we can look up (or replace) the Google
// identity currently linked to a given account in O(1).
const googleIdByUserId = new Map<string, string>();

/**
 * Link a Google identity to a user account.
 *
 * Refuses when the Google identity is already linked to a DIFFERENT account.
 * Re-linking the same Google identity to the same account is idempotent and
 * simply refreshes the record (e.g. updated email).
 */
export function linkGoogleAccount(
  userId: string,
  googleId: string,
  email: string | null
): LinkResult {
  const existing = linksByGoogleId.get(googleId);

  if (existing && existing.user_id !== userId) {
    return {
      ok: false,
      error: "This Google account is already linked to a different account.",
      status: 409,
    };
  }

  const record: GoogleLinkRecord = {
    user_id: userId,
    google_id: googleId,
    email,
    linked_at: existing?.user_id === userId ? existing.linked_at : new Date().toISOString(),
  };

  linksByGoogleId.set(googleId, record);
  googleIdByUserId.set(userId, googleId);

  return { ok: true, record };
}

export function getGoogleLinkForUser(userId: string): GoogleLinkRecord | null {
  const googleId = googleIdByUserId.get(userId);
  if (!googleId) {
    return null;
  }
  return linksByGoogleId.get(googleId) ?? null;
}

export function getGoogleLinkOwner(googleId: string): GoogleLinkRecord | null {
  return linksByGoogleId.get(googleId) ?? null;
}

export function __resetGoogleLinkStore(): void {
  linksByGoogleId.clear();
  googleIdByUserId.clear();
}
