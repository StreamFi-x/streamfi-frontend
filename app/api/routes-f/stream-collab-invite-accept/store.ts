import type { CollabInvite } from "./types";
import { collabInviteStore } from "./seedData";

export class InviteNotFoundError extends Error {}
export class InviteNotPendingError extends Error {}
export class InviteNotRecipientError extends Error {}

function generateSessionId(): string {
  return `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function acceptInvite(
  inviteId: string,
  creatorId: string
): { invite: CollabInvite; collab_session_id: string } {
  const invite = collabInviteStore.get(inviteId);
  if (!invite) {
    throw new InviteNotFoundError(`invite '${inviteId}' not found`);
  }
  if (invite.to_creator_id !== creatorId) {
    throw new InviteNotRecipientError(
      `creator '${creatorId}' is not the recipient of invite '${inviteId}'`
    );
  }
  if (invite.status !== "pending") {
    throw new InviteNotPendingError(
      `invite '${inviteId}' is already ${invite.status}`
    );
  }

  const updated: CollabInvite = {
    ...invite,
    status: "accepted",
    resolved_at: new Date().toISOString(),
  };
  collabInviteStore.set(inviteId, updated);

  return { invite: updated, collab_session_id: generateSessionId() };
}
