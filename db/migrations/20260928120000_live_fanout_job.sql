-- Live fan-out job idempotency marker (#1138).
--
-- live_fanout_jobs tracks the progress of a live-notification fan-out for one
-- (creator, stream-session) pair. On first run the job inserts a row with
-- ON CONFLICT DO NOTHING; on retry it reads back the row and resumes from
-- last_processed_follower_id. When the last page of followers is processed
-- the row is updated to status='completed', after which any duplicate
-- delivery is a cheap no-op.

CREATE TABLE IF NOT EXISTS live_fanout_jobs (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id                  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stream_session_id           UUID        REFERENCES stream_sessions(id) ON DELETE SET NULL,
  status                      TEXT        NOT NULL DEFAULT 'pending'
                                          CHECK (status IN ('pending', 'in_progress', 'completed')),
  last_processed_follower_id  UUID,
  notified_count              INT         NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (creator_id, stream_session_id)
);

CREATE INDEX IF NOT EXISTS idx_live_fanout_jobs_status_created
  ON live_fanout_jobs (status, created_at);

-- Rollback (manual):
--   DROP INDEX IF EXISTS idx_live_fanout_jobs_status_created;
--   DROP TABLE IF EXISTS live_fanout_jobs;
