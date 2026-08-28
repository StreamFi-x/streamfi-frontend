import type { TwitterLinkRecord } from "./types";

export class TwitterAlreadyLinkedError extends Error {}

// Keyed by user_id. A separate map tracks which twitter_id is already
// claimed by a different user, so the same Twitter account can't be linked
// to two StreamFi accounts at once.
const userTwitterLinkStore = new Map<string, TwitterLinkRecord>();
const twitterIdToUserId = new Map<string, string>();

export function linkTwitterAccount(
  userId: string,
  twitterId: string,
  username: string
): TwitterLinkRecord {
  const existingOwner = twitterIdToUserId.get(twitterId);
  if (existingOwner && existingOwner !== userId) {
    throw new TwitterAlreadyLinkedError(
      `Twitter account '${username}' is already linked to a different account`
    );
  }

  const record: TwitterLinkRecord = {
    twitter_id: twitterId,
    username,
    linked_at: new Date().toISOString(),
  };

  userTwitterLinkStore.set(userId, record);
  twitterIdToUserId.set(twitterId, userId);

  return record;
}

/** Test-only accessor to seed a pre-existing link (simulates a different
 * account already owning a Twitter id). */
export function __seedTwitterLink(userId: string, twitterId: string): void {
  twitterIdToUserId.set(twitterId, userId);
}

/** Test-only accessor to reset store state between test cases. */
export function __resetTwitterLinkStore(): void {
  userTwitterLinkStore.clear();
  twitterIdToUserId.clear();
}
