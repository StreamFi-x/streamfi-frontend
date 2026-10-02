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

export interface InviteDeclineBody {
  invite_id: string;
  creator_id: string;
}

export interface InviteDeclineResponse {
  invite: CollabInvite;
}
