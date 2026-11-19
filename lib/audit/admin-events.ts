import { sql } from "@vercel/postgres";
import { withTransaction, type Tx } from "@/lib/postgres-transaction";

export type AdminAuditEvent = {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  requestIp?: string | null;
};

export async function recordAdminEvent(tx: Tx, event: AdminAuditEvent): Promise<void> {
  await tx.sql`
    INSERT INTO admin_audit_log
      (actor_id, action, target_type, target_id, before_state, after_state, request_ip)
    VALUES (
      ${event.actorId}, ${event.action}, ${event.targetType}, ${event.targetId},
      ${event.beforeState ? JSON.stringify(event.beforeState) : null}::JSONB,
      ${event.afterState ? JSON.stringify(event.afterState) : null}::JSONB,
      ${event.requestIp ?? null}::INET
    )
  `;
}

export async function withAdminAudit<T>(
  event: AdminAuditEvent,
  mutate: (tx: Tx) => Promise<{ result: T; beforeState?: Record<string, unknown> | null; afterState?: Record<string, unknown> | null }>
): Promise<T> {
  return withTransaction(async tx => {
    const outcome = await mutate(tx);
    await recordAdminEvent(tx, { ...event, ...outcome });
    return outcome.result;
  });
}

export async function queryAdminEvents(filters: {
  actorId?: string | null;
  targetId?: string | null;
  from?: string | null;
  to?: string | null;
  cursor?: string | null;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(filters.limit ?? 50, 100));
  const cursor = filters.cursor ? Number(filters.cursor) : null;
  const { rows } = await sql`
    SELECT id, actor_id, action, target_type, target_id, before_state, after_state,
           request_ip::TEXT AS request_ip, created_at
    FROM admin_audit_log
    WHERE (${filters.actorId ?? null}::TEXT IS NULL OR actor_id = ${filters.actorId ?? null})
      AND (${filters.targetId ?? null}::TEXT IS NULL OR target_id = ${filters.targetId ?? null})
      AND (${filters.from ?? null}::TIMESTAMPTZ IS NULL OR created_at >= ${filters.from ?? null}::TIMESTAMPTZ)
      AND (${filters.to ?? null}::TIMESTAMPTZ IS NULL OR created_at < ${filters.to ?? null}::TIMESTAMPTZ)
      AND (${cursor}::BIGINT IS NULL OR id < ${cursor})
    ORDER BY id DESC
    LIMIT ${limit + 1}
  `;
  const hasMore = rows.length > limit;
  const events = rows.slice(0, limit);
  return {
    events,
    nextCursor: hasMore ? String(events[events.length - 1].id) : null,
  };
}