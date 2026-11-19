-- #1399 Mux <-> DB live-state reconciliation.

-- When users.is_live last actually flipped. Maintained by a trigger so every
-- writer (Mux webhooks, /api/streams/start, admin suspension, the
-- reconciliation job) is covered without each one having to remember it.
-- The reconciliation job never overwrites a row whose live state changed
-- after it started querying Mux (minus a grace window), so a webhook that
-- lands mid-run always wins over the job's older observation.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS live_state_changed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION set_users_live_state_changed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_live IS DISTINCT FROM OLD.is_live THEN
    NEW.live_state_changed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_live_state_changed_at ON users;
CREATE TRIGGER trg_users_live_state_changed_at
  BEFORE UPDATE OF is_live ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_users_live_state_changed_at();

CREATE INDEX IF NOT EXISTS idx_users_mux_stream_id
  ON users (mux_stream_id)
  WHERE mux_stream_id IS NOT NULL;

-- Lease + health bookkeeping for scheduled jobs. The lease prevents
-- overlapping runs across serverless instances; the timestamps and counters
-- make a failing or silently-stopped job observable.
CREATE TABLE IF NOT EXISTS scheduled_job_runs (
  job_name               TEXT PRIMARY KEY,
  lease_owner            TEXT,
  lease_expires_at       TIMESTAMPTZ,
  last_started_at        TIMESTAMPTZ,
  last_finished_at       TIMESTAMPTZ,
  last_succeeded_at      TIMESTAMPTZ,
  last_failed_at         TIMESTAMPTZ,
  last_error             TEXT,
  consecutive_failures   INTEGER NOT NULL DEFAULT 0,
  consecutive_drift_runs INTEGER NOT NULL DEFAULT 0,
  last_summary           JSONB
);
