CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  request_ip INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_actor_time
  ON admin_audit_log (actor_id, id DESC);
CREATE INDEX IF NOT EXISTS admin_audit_target_time
  ON admin_audit_log (target_type, target_id, id DESC);
CREATE INDEX IF NOT EXISTS admin_audit_created
  ON admin_audit_log (created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION admin_audit_log_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS admin_audit_log_no_mutation ON admin_audit_log;
CREATE TRIGGER admin_audit_log_no_mutation
  BEFORE UPDATE OR DELETE ON admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION admin_audit_log_append_only();