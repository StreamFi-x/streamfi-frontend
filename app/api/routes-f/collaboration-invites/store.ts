/* eslint-disable @typescript-eslint/no-unused-vars */
import type { CollaborationInvite, InviteStatus } from "./types";

// In-memory store for collaboration invites
export const inviteStore = new Map<string, CollaborationInvite>();

// Helper to generate invite ID
function generateInviteId(): string {
  return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to check if pending invite exists between creators
export function hasPendingInvite(
  from_creator_id: string,
  to_creator_id: string
): boolean {
  for (const invite of inviteStore.values()) {
    if (
      invite.from_creator_id === from_creator_id &&
      invite.to_creator_id === to_creator_id &&
      invite.status === "pending"
    ) {
      return true;
    }
  }
  return false;
}

// Create a new invitation
export function createInvite(
  from_creator_id: string,
  to_creator_id: string,
  stream_id: string,
  message?: string
): CollaborationInvite {
  const now = new Date().toISOString();
  const invite: CollaborationInvite = {
    invite_id: generateInviteId(),
    from_creator_id,
    to_creator_id,
    stream_id,
    message,
    status: "pending",
    created_at: now,
    updated_at: now,
  };

  inviteStore.set(invite.invite_id, invite);
  return invite;
}

// Respond to an invitation
export function respondToInvite(
  invite_id: string,
  decision: "accept" | "decline"
): CollaborationInvite | null {
  const invite = inviteStore.get(invite_id);
  if (!invite) {
    return null;
  }

  const updatedInvite: CollaborationInvite = {
    ...invite,
    status: decision === "accept" ? "accepted" : "declined",
    updated_at: new Date().toISOString(),
  };

  inviteStore.set(invite_id, updatedInvite);
  return updatedInvite;
}

// List invites for a creator
export function listInvitesForCreator(creator_id: string): {
  incoming: CollaborationInvite[];
  outgoing: CollaborationInvite[];
} {
  const incoming: CollaborationInvite[] = [];
  const outgoing: CollaborationInvite[] = [];

  for (const invite of inviteStore.values()) {
    if (invite.to_creator_id === creator_id) {
      incoming.push(invite);
    }
    if (invite.from_creator_id === creator_id) {
      outgoing.push(invite);
    }
  }

  return { incoming, outgoing };
}

// Get invite by ID
export function getInviteById(invite_id: string): CollaborationInvite | null {
  return inviteStore.get(invite_id) || null;
}

// Clear store (for testing)
export function clearInviteStore(): void {
  inviteStore.clear();
}