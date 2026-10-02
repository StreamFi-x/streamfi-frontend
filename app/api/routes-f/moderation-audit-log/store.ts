import { randomUUID } from "crypto";
import type {
  AuditLogPage,
  LogActionInput,
  ModerationActionType,
  ModerationAuditEntry,
} from "./types";

// In-memory store — no DB, matching the other routes-f moderation mocks
// (ban-appeals, ban-sync, mod-team, moderation-appeal-submit).
//
// `seq` is a monotonic insertion counter used as a tiebreaker when sorting.
// Two actions logged within the same millisecond would otherwise have an
// ambiguous order since created_at (ISO string, ms resolution) can collide.
let seq = 0;
const auditLog: (ModerationAuditEntry & { seq: number })[] = [];

/**
 * Appends a moderator-action entry to the audit log. Intended to be called
 * by other moderation routes (ban, unban, mod-add, appeal-review, etc.) as
 * those actions happen — this route only owns the read/list side.
 */
export function logModerationAction(
  input: LogActionInput
): ModerationAuditEntry {
  const entry: ModerationAuditEntry & { seq: number } = {
    id: randomUUID(),
    creator_id: input.creator_id,
    moderator_id: input.moderator_id,
    action: input.action,
    target_viewer_id: input.target_viewer_id ?? null,
    reason: input.reason ?? null,
    created_at: new Date().toISOString(),
    seq: seq++,
  };
  auditLog.push(entry);
  const { seq: _seq, ...publicEntry } = entry;
  return publicEntry;
}

export interface ListAuditLogOptions {
  creator_id: string;
  page: number;
  limit: number;
  action?: ModerationActionType;
}

/**
 * Returns a page of audit log entries for a channel, newest first.
 */
export function listAuditLog(options: ListAuditLogOptions): AuditLogPage {
  const { creator_id, page, limit, action } = options;

  let filtered = auditLog.filter(e => e.creator_id === creator_id);
  if (action) {
    filtered = filtered.filter(e => e.action === action);
  }

  // Newest first; seq breaks ties for entries logged in the same millisecond.
  filtered.sort((a, b) => b.seq - a.seq);

  const total = filtered.length;
  const start = (page - 1) * limit;
  const entries = filtered
    .slice(start, start + limit)
    .map(({ seq: _seq, ...publicEntry }) => publicEntry);
  const has_more = start + entries.length < total;

  return { entries, total, page, limit, has_more };
}

export function __resetAuditLogStore(): void {
  auditLog.length = 0;
  seq = 0;
}
