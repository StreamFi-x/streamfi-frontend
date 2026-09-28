-- Append-only audit trail shared by the review workflows: subscription
-- cancellation and refunds (#1426), category requests (#1429), stream
-- schedules (#1428) and creator verification (#1425).
--
-- actor_id is TEXT without a foreign key: admins are identified by their
-- Privy ID (lib/admin-auth.ts) and the trail must survive account purges.
-- Rows never carry evidence contents, only states, reasons and identifiers.

CREATE TABLE IF NOT EXISTS workflow_audit_events (
  id          BIGSERIAL   PRIMARY KEY,
  workflow    TEXT        NOT NULL CHECK (workflow IN (
                'subscription', 'refund_request', 'category_request',
                'stream_schedule', 'verification')),
  subject_id  UUID        NOT NULL,
  action      TEXT        NOT NULL,
  actor_type  TEXT        NOT NULL CHECK (actor_type IN ('user', 'admin', 'system')),
  actor_id    TEXT,
  from_state  TEXT,
  to_state    TEXT,
  reason      TEXT,
  metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_audit_subject
  ON workflow_audit_events (workflow, subject_id, created_at);

CREATE OR REPLACE FUNCTION workflow_audit_events_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'workflow_audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS workflow_audit_events_no_mutation ON workflow_audit_events;
CREATE TRIGGER workflow_audit_events_no_mutation
  BEFORE UPDATE OR DELETE ON workflow_audit_events
  FOR EACH ROW EXECUTE FUNCTION workflow_audit_events_append_only();
