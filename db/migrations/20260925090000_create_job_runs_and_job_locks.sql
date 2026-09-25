-- Shared bookkeeping for scheduled jobs (#1400, #1402, #1401 cleanup).
--
-- job_locks: lease-based mutual exclusion. A run takes the lease with a single
-- atomic upsert and only succeeds when no unexpired lease exists, so
-- overlapping cron invocations (retries, slow runs, duplicate deliveries)
-- cannot process the same records concurrently. Leases expire on their own if
-- a run crashes without releasing.
CREATE TABLE IF NOT EXISTS job_locks (
  job_name     TEXT PRIMARY KEY,
  holder       TEXT NOT NULL,
  acquired_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ NOT NULL
);

-- job_runs: one row per execution with its counters, so repeated failures,
-- abnormal correction rates and a job that has stopped running are
-- observable from the database.
CREATE TABLE IF NOT EXISTS job_runs (
  id          BIGSERIAL PRIMARY KEY,
  job_name    TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('succeeded', 'partial', 'failed', 'skipped')),
  started_at  TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER NOT NULL,
  metrics     JSONB NOT NULL DEFAULT '{}'::jsonb,
  error       TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job_name_started_at
  ON job_runs (job_name, started_at DESC);
