-- Background job dispatch (#1416). See docs/background-jobs.md.
--
-- job_runs gains the delivery a run belongs to. QStash retries a failed
-- delivery with the same message id, so (job_name, message_id) identifies one
-- logical job execution across its attempts:
-- - a delivery whose message already succeeded is acknowledged without running
--   again (duplicate delivery);
-- - the attempt number is derived from earlier failed runs of the message.
-- Runs started by an operator (CRON_SECRET) have no message id.
ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS message_id TEXT;
ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS attempt INTEGER;
ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS trigger TEXT;

CREATE INDEX IF NOT EXISTS idx_job_runs_message
  ON job_runs (job_name, message_id)
  WHERE message_id IS NOT NULL;

-- job_dead_letters: a job execution that will not be retried any more, with
-- enough context to investigate and replay it. Written when a delivery fails
-- its last attempt (retries_exhausted) or fails with an error that retrying
-- cannot fix (permanent). resolved_at is set when a later delivery of the same
-- message succeeds (for example a replay from the QStash DLQ).
CREATE TABLE IF NOT EXISTS job_dead_letters (
  id               BIGSERIAL PRIMARY KEY,
  job_name         TEXT NOT NULL,
  message_id       TEXT NOT NULL,
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts         INTEGER NOT NULL,
  reason           TEXT NOT NULL CHECK (reason IN ('retries_exhausted', 'permanent')),
  error            TEXT NOT NULL,
  dead_lettered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ,
  UNIQUE (job_name, message_id)
);

CREATE INDEX IF NOT EXISTS idx_job_dead_letters_unresolved
  ON job_dead_letters (dead_lettered_at DESC)
  WHERE resolved_at IS NULL;

-- Rollback (manual):
--   DROP TABLE IF EXISTS job_dead_letters;
--   DROP INDEX IF EXISTS idx_job_runs_message;
--   ALTER TABLE job_runs DROP COLUMN IF EXISTS trigger,
--     DROP COLUMN IF EXISTS attempt, DROP COLUMN IF EXISTS message_id;
