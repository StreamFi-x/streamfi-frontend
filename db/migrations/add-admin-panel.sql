-- Admin panel migration: user banning + report tables
-- Run once; all statements are idempotent.

-- ── User banning columns ───────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_banned  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- ── Stream reports ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stream_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id TEXT        NOT NULL,
  stream_id   TEXT        NOT NULL,
  streamer    TEXT        NOT NULL,
  reason      TEXT        NOT NULL,
  details     TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending',  -- pending | reviewed | dismissed
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stream_reports_status_idx ON stream_reports (status);
CREATE INDEX IF NOT EXISTS stream_reports_created_at_idx ON stream_reports (created_at DESC);

-- ── Bug reports ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bug_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id TEXT        NOT NULL,
  category    TEXT        NOT NULL,
  description TEXT        NOT NULL,
  severity    TEXT        NOT NULL DEFAULT 'medium',  -- low | medium | high | critical
  status      TEXT        NOT NULL DEFAULT 'pending', -- pending | reviewed | resolved
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bug_reports_status_idx    ON bug_reports (status);
CREATE INDEX IF NOT EXISTS bug_reports_severity_idx  ON bug_reports (severity);
CREATE INDEX IF NOT EXISTS bug_reports_created_at_idx ON bug_reports (created_at DESC);
