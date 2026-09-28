/**
 * Append-only audit trail for the review workflows added alongside this
 * module: subscription cancellation/refunds (#1426), category requests
 * (#1429), stream scheduling (#1428) and creator verification (#1425).
 *
 * Backed by workflow_audit_events (append-only at the DB level via trigger).
 * Never pass evidence contents, tokens or other sensitive values in
 * `metadata` — only identifiers, states and reasons.
 */
import { defaultExecutor, SqlExecutor } from "@/lib/db/executor";

export type WorkflowName =
  | "subscription"
  | "refund_request"
  | "category_request"
  | "stream_schedule"
  | "verification";

export type ActorType = "user" | "admin" | "system";

export interface WorkflowAuditEvent {
  workflow: WorkflowName;
  subjectId: string;
  action: string;
  actorType: ActorType;
  actorId?: string | null;
  fromState?: string | null;
  toState?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordWorkflowEvent(
  event: WorkflowAuditEvent,
  executor: SqlExecutor = defaultExecutor
): Promise<void> {
  await executor(
    `INSERT INTO workflow_audit_events
       (workflow, subject_id, action, actor_type, actor_id, from_state, to_state, reason, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
    [
      event.workflow,
      event.subjectId,
      event.action,
      event.actorType,
      event.actorId ?? null,
      event.fromState ?? null,
      event.toState ?? null,
      event.reason ?? null,
      JSON.stringify(event.metadata ?? {}),
    ]
  );
}
