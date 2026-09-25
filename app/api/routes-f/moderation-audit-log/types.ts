export type ModerationActionType =
  | "ban"
  | "unban"
  | "timeout"
  | "mod_add"
  | "mod_remove"
  | "message_delete"
  | "appeal_accept"
  | "appeal_reject";

export interface ModerationAuditEntry {
  id: string;
  creator_id: string;
  moderator_id: string;
  action: ModerationActionType;
  target_viewer_id: string | null;
  reason: string | null;
  created_at: string;
}

export interface LogActionInput {
  creator_id: string;
  moderator_id: string;
  action: ModerationActionType;
  target_viewer_id?: string | null;
  reason?: string | null;
}

export interface AuditLogPage {
  entries: ModerationAuditEntry[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}
