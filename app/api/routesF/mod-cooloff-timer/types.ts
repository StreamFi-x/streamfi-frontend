export type ModAction = 'ban' | 'timeout' | 'warn' | 'mute';

export interface ModCooloffCheckRequest {
  mod_id: string;
  action: ModAction;
}

export interface ModCooloffCheckResponse {
  allowed: boolean;
  seconds_remaining?: number;
}

export interface ModCooloffRecordRequest {
  mod_id: string;
  action: ModAction;
}

export interface ModCooloffRecordResponse {
  success: boolean;
  timestamp: number;
}

// In-memory store for last action timestamps per mod
// In production, this would be a database
export interface ModActionRecord {
  mod_id: string;
  last_action_timestamp: number;
  last_action: ModAction;
}
