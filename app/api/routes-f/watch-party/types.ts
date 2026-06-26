export interface WatchPartyState {
  party_id: string;
  join_code: string;
  host_id: string;
  vod_id: string;
  /** Viewer ids currently in the party (host included). */
  members: string[];
  /** Current playback position in seconds. */
  position_seconds: number;
  /** Whether playback is paused. */
  paused: boolean;
  /** ISO timestamp of the last sync/update. */
  updated_at: string;
}

export interface CreateRequest {
  host_id: string;
  vod_id: string;
}

export interface CreateResponse {
  party_id: string;
  join_code: string;
}

export interface SyncRequest {
  party_id: string;
  position_seconds: number;
  paused: boolean;
}

export interface JoinRequest {
  party_id: string;
  viewer_id: string;
}
