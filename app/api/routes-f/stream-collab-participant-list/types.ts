export interface CollabParticipant {
  creator_id: string;
  username: string;
  /** ISO timestamp the participant joined the session. */
  joined_at: string;
  role: "host" | "guest";
}

export interface CollabSession {
  collab_session_id: string;
  stream_id: string;
  status: "active" | "ended";
  participants: CollabParticipant[];
}

export interface ParticipantListResponse {
  collab_session_id: string;
  stream_id: string;
  status: CollabSession["status"];
  participants: CollabParticipant[];
}
