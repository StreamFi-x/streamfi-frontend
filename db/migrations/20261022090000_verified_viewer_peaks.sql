-- #1096: preserve old peaks as unverified history; never infer a replacement.
ALTER TABLE stream_sessions ADD COLUMN IF NOT EXISTS legacy_peak_viewers INTEGER;
ALTER TABLE stream_sessions ADD COLUMN IF NOT EXISTS peak_viewers_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE stream_sessions ALTER COLUMN peak_viewers DROP NOT NULL;
UPDATE stream_sessions SET legacy_peak_viewers = peak_viewers, peak_viewers = NULL
WHERE NOT peak_viewers_verified AND legacy_peak_viewers IS NULL;

ALTER TABLE stream_viewers ADD COLUMN IF NOT EXISTS left_reason TEXT
  CHECK (left_reason IN ('expired', 'explicit'));

-- Keep duplicate counts (without copying viewer PII) before idempotent joins. Run this migration
-- with viewer writes paused (the migration runner wraps it in a transaction).
CREATE TABLE IF NOT EXISTS stream_viewer_duplicate_audit (
  stream_session_id UUID PRIMARY KEY REFERENCES stream_sessions(id) ON DELETE CASCADE,
  removed_rows BIGINT NOT NULL,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY stream_session_id, session_id
    ORDER BY left_at NULLS FIRST, heartbeat_at DESC NULLS LAST, joined_at, id
  ) AS n FROM stream_viewers
), removed AS (
  DELETE FROM stream_viewers WHERE id IN (SELECT id FROM ranked WHERE n > 1) RETURNING *
)
INSERT INTO stream_viewer_duplicate_audit (stream_session_id, removed_rows)
SELECT stream_session_id, count(*) FROM removed WHERE stream_session_id IS NOT NULL
GROUP BY stream_session_id
ON CONFLICT (stream_session_id) DO UPDATE
SET removed_rows = stream_viewer_duplicate_audit.removed_rows + EXCLUDED.removed_rows;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stream_viewers_session_identity
  ON stream_viewers (stream_session_id, session_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_live_session
  ON stream_viewers (stream_session_id, heartbeat_at) WHERE left_at IS NULL;

-- Bounded evidence: retain the highest confirmed sample for each stream.
CREATE TABLE IF NOT EXISTS stream_viewer_peak_samples (
  stream_session_id UUID PRIMARY KEY REFERENCES stream_sessions(id) ON DELETE CASCADE,
  viewer_count INTEGER NOT NULL CHECK (viewer_count >= 0),
  distinct_ips INTEGER NOT NULL CHECK (distinct_ips >= 0),
  sampled_at TIMESTAMPTZ NOT NULL,
  freshness_seconds INTEGER NOT NULL CHECK (freshness_seconds > 0),
  confirmation_seconds INTEGER NOT NULL CHECK (confirmation_seconds > 0)
);
