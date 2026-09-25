-- Shared infrastructure for scheduled jobs (#1405, #1406, #1409).
--
-- job_leases: one row per job name. A worker owns the job while
--   lease_until is in the future. Acquisition is a single atomic
--   INSERT ... ON CONFLICT statement, so it works with the stateless
--   @vercel/postgres HTTP/WebSocket driver where session-level advisory
--   locks cannot be relied on (consecutive queries may use different
--   connections).
-- job_runs: durable record of every scheduled/admin-triggered run with
--   aggregate metrics, used for observability and (for tip reconciliation)
--   as the historical baseline.
--
-- Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS job_leases (
  job_name    TEXT        PRIMARY KEY,
  holder      TEXT        NOT NULL,
  lease_until TIMESTAMPTZ NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_runs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name    TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'running'
              CHECK (status IN ('running', 'completed', 'partial', 'failed', 'abandoned')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  metrics     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  error       TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job_started
  ON job_runs (job_name, started_at DESC);
