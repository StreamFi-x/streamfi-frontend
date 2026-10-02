export interface HandoffEntry {
  stream_id: string;
  from_user_id: string;
  to_user_id: string;
  handed_off_at: string;
}

export interface HandoffRequest {
  stream_id: string;
  from_user_id: string;
  to_user_id: string;
}

export interface HandoffResponse {
  handed_off_at: string;
}

export interface HandoffLogResponse {
  stream_id: string;
  log: HandoffEntry[];
}

/**
 * Minimal stream record used by the handoff endpoint. In a real app this would
 * be backed by the live stream table; here we keep a self-contained shape so
 * the route is scope-clean.
 */
export interface StreamRecord {
  stream_id: string;
  /** The user currently in control of the broadcast. */
  current_host_id: string;
  /** Allowed hosts that may receive a handoff. */
  hosts: string[];
}
