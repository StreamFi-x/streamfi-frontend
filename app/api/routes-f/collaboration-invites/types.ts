export type InviteStatus = "pending" | "accepted" | "declined";

export interface CollaborationInvite {
  invite_id: string;
  from_creator_id: string;
  to_creator_id: string;
  stream_id: string;
  message?: string;
  status: InviteStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateInviteRequest {
  from_creator_id: string;
  to_creator_id: string;
  stream_id: string;
  message?: string;
}

export interface CreateInviteResponse {
  invite_id: string;
  status: InviteStatus;
}

export interface RespondInviteRequest {
  invite_id: string;
  decision: "accept" | "decline";
}

export interface RespondInviteResponse {
  invite_id: string;
  status: InviteStatus;
}

export interface ListInvitesRequest {
  creator_id: string;
}

export interface ListInvitesResponse {
  incoming: CollaborationInvite[];
  outgoing: CollaborationInvite[];
}

export interface InviteStats {
  incoming_count: number;
  outgoing_count: number;
  pending_count: number;
}