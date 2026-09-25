-- #1402: mark sessions closed by the reconciliation job.
--
-- When the Mux idle webhook is missed, the real end time is unknown and the
-- job writes an estimated ended_at. end_source = 'reconciliation' marks those
-- rows so analytics can tell an estimate from an event-driven close.
-- NULL means the session was closed by a webhook, manual stop or admin action
-- (all of which record the time the event was handled).
ALTER TABLE stream_sessions
  ADD COLUMN IF NOT EXISTS end_source VARCHAR(32);

DO $$
BEGIN
  ALTER TABLE stream_sessions
    ADD CONSTRAINT stream_sessions_end_source_check
    CHECK (end_source IS NULL OR end_source IN ('reconciliation'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- The job scans open sessions oldest first.
CREATE INDEX IF NOT EXISTS idx_stream_sessions_open_started_at
  ON stream_sessions (started_at)
  WHERE ended_at IS NULL;
