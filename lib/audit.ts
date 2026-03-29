import { sql } from "@vercel/postgres";

export interface AuditLogEntry {
  userId?: string | null;
  actorId?: string | null;
  eventType: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Fire-and-forget audit log insert. Failures are silently ignored so they
 * never block the caller's response.
 */
export function insertAuditLog(entry: AuditLogEntry): void {
  sql`
    INSERT INTO audit_logs (user_id, actor_id, event_type, metadata, ip_address, user_agent)
    VALUES (
      ${entry.userId ?? null},
      ${entry.actorId ?? null},
      ${entry.eventType},
      ${entry.metadata ? JSON.stringify(entry.metadata) : null},
      ${entry.ipAddress ?? null},
      ${entry.userAgent ?? null}
    )
  `.catch(() => {});
}
