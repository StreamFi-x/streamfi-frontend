export interface CollabParticipant {
  creator_id: string;
  username: string;
  joined_at: string;
  role: "host" | "guest";
}

export interface CollabSession {
  collab_session_id: string;
  stream_id: string;
  status: "active" | "ended";
  participants: CollabParticipant[];
}

export interface LeaveBody {
  collab_session_id: string;
  creator_id: string;
}

export interface LeaveResponse {
  collab_session_id: string;
  status: CollabSession["status"];
  participants: CollabParticipant[];
}
