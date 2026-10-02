-- Session-level analytics: retention curves and materialized views
-- Backfill tooling status tracking

-- Track session viewer retention at 5-minute intervals
CREATE TABLE IF NOT EXISTS route_f_session_retention (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
  bucket_seconds INT NOT NULL,  -- time offset from session start in seconds
  viewers_remaining INT NOT NULL,  -- count of viewers still watching at this point
  cumulative_viewers INT NOT NULL,  -- total unique viewers who joined up to this point
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_retention_unique 
  ON route_f_session_retention(session_id, bucket_seconds);

CREATE INDEX IF NOT EXISTS idx_session_retention_session_id 
  ON route_f_session_retention(session_id);

-- Chat engagement bucketed by 5-minute intervals within session
CREATE TABLE IF NOT EXISTS route_f_session_chat_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
  bucket_seconds INT NOT NULL,  -- time offset from session start in seconds
  message_count INT NOT NULL,
  unique_chatters INT NOT NULL,
  messages_per_viewer NUMERIC(10,4),  -- normalized by concurrent viewers
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_chat_engagement_unique 
  ON route_f_session_chat_engagement(session_id, bucket_seconds);

CREATE INDEX IF NOT EXISTS idx_session_chat_engagement_session_id 
  ON route_f_session_chat_engagement(session_id);

-- Backfill job tracking: idempotent status for each analytics table
CREATE TABLE IF NOT EXISTS route_f_backfill_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL UNIQUE,  -- 'watch_history' | 'stream_viewers' | 'session_retention' | 'session_chat_engagement'
  last_backfill_at TIMESTAMPTZ,
  last_cursor BIGINT,  -- for resumable pagination
  rows_backfilled BIGINT NOT NULL DEFAULT 0,
  rows_skipped BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'in_progress' | 'completed' | 'failed'
  error_message TEXT,
  estimated_remaining_rows BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backfill_status_table_name 
  ON route_f_backfill_status(table_name);

-- Backfill cursor for watch_history reconstruction (by date partitions)
CREATE TABLE IF NOT EXISTS route_f_backfill_watch_history_cursor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_partition DATE NOT NULL UNIQUE,
  last_processed_id UUID,
  rows_processed INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'completed' | 'skipped'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backfill_watch_history_cursor_date 
  ON route_f_backfill_watch_history_cursor(date_partition DESC);

-- Backfill cursor for stream_viewers reconstruction
CREATE TABLE IF NOT EXISTS route_f_backfill_stream_viewers_cursor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES stream_sessions(id) ON DELETE CASCADE,
  last_processed_viewer_id UUID,
  retention_buckets_calculated BOOLEAN NOT NULL DEFAULT FALSE,
  rows_processed INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'completed' | 'skipped'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backfill_stream_viewers_cursor_status 
  ON route_f_backfill_stream_viewers_cursor(status, updated_at ASC);

-- Idempotent backfill function: mark rows as backfilled
CREATE TABLE IF NOT EXISTS route_f_backfill_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backfill_job_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,  -- 'inserted' | 'skipped' | 'updated'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backfill_log_job_id 
  ON route_f_backfill_log(backfill_job_id);

CREATE INDEX IF NOT EXISTS idx_backfill_log_record_id 
  ON route_f_backfill_log(table_name, record_id);

-- Trigger to auto-update route_f_backfill_status.updated_at
CREATE OR REPLACE FUNCTION update_backfill_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_backfill_status_updated_at 
  ON route_f_backfill_status;

CREATE TRIGGER trigger_backfill_status_updated_at
  BEFORE UPDATE ON route_f_backfill_status
  FOR EACH ROW
  EXECUTE FUNCTION update_backfill_status_updated_at();

DROP TRIGGER IF EXISTS trigger_backfill_watch_history_cursor_updated_at 
  ON route_f_backfill_watch_history_cursor;

CREATE TRIGGER trigger_backfill_watch_history_cursor_updated_at
  BEFORE UPDATE ON route_f_backfill_watch_history_cursor
  FOR EACH ROW
  EXECUTE FUNCTION update_backfill_status_updated_at();

DROP TRIGGER IF EXISTS trigger_backfill_stream_viewers_cursor_updated_at 
  ON route_f_backfill_stream_viewers_cursor;

CREATE TRIGGER trigger_backfill_stream_viewers_cursor_updated_at
  BEFORE UPDATE ON route_f_backfill_stream_viewers_cursor
  FOR EACH ROW
  EXECUTE FUNCTION update_backfill_status_updated_at();
