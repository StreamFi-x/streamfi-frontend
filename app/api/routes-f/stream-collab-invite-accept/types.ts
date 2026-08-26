export type CollabInviteStatus = "pending" | "accepted" | "declined";

export interface CollabInvite {
  invite_id: string;
  from_creator_id: string;
  to_creator_id: string;
  stream_id: string;
  status: CollabInviteStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface InviteAcceptBody {
  invite_id: string;
  creator_id: string;
}

export interface InviteAcceptResponse {
  invite: CollabInvite;
  collab_session_id: string;
}
