-- #1402: mark force-closed orphaned stream_sessions rows
-- Run after schema.sql / migrate-to-mux.sql

-- 1. When the closing webhook is missed, the real end time is gone. The
--    orphan-session reaper backfills ended_at with its own run time, which is
--    the only honest value available — this flag says so, so duration
--    analytics can separate estimates from precise webhook timestamps.
ALTER TABLE stream_sessions
ADD COLUMN IF NOT EXISTS ended_at_estimated BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN stream_sessions.ended_at_estimated IS
  'TRUE when ended_at was backfilled by the orphan-session reaper (#1402) instead of captured from a Mux idle webhook, i.e. an estimate';

-- 2. Both the reaper's candidate scan and the active-session dedup check
--    filter on ended_at IS NULL, which is the hot path for these rows.
CREATE INDEX IF NOT EXISTS idx_stream_sessions_open_by_user
  ON stream_sessions (user_id)
  WHERE ended_at IS NULL;
