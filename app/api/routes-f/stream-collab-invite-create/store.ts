import type { CollabInvite } from "./types";
import { collabInviteStore } from "./seedData";

export class SelfInviteError extends Error {}

function generateInviteId(): string {
  return `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Creates a pending collab invite from one creator to another for a given
 * stream. A creator cannot invite themselves.
 */
export function createInvite(
  fromCreatorId: string,
  toCreatorId: string,
  streamId: string
): CollabInvite {
  if (fromCreatorId === toCreatorId) {
    throw new SelfInviteError("a creator cannot invite themselves to a collab");
  }

  const invite: CollabInvite = {
    invite_id: generateInviteId(),
    from_creator_id: fromCreatorId,
    to_creator_id: toCreatorId,
    stream_id: streamId,
    status: "pending",
    created_at: new Date().toISOString(),
    resolved_at: null,
  };

  collabInviteStore.set(invite.invite_id, invite);
  return invite;
}
