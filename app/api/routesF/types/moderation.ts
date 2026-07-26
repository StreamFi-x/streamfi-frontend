export type ModerationAction = 'BAN' | 'UNBAN' | 'TIMEOUT' | 'WARNING' | 'DELETE_MESSAGE';

export interface ModerationLog {
  id: string;
  creator_id: string;
  mod_id: string;
  action: ModerationAction;
  target_id: string;
  reason?: string;
  timestamp: string;
}

export interface LogModerationRequest {
  creator_id: string;
  mod_id: string;
  action: ModerationAction;
  target_id: string;
  reason?: string;
}

export interface GetModerationLogsRequest {
  creator_id: string;
  mod_id?: string;
}

export interface ModerationLogsResponse {
  logs: ModerationLog[];
}