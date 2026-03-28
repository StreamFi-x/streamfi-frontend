-- Background jobs table for async task processing.
-- Applied: 2026-03-27

CREATE TYPE IF NOT EXISTS job_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE IF NOT EXISTS job_type AS ENUM (
  'export',
  'clip_process',
  'batch_notify',
  'leaderboard_refresh',
  'sitemap_refresh'
);

CREATE TABLE IF NOT EXISTS jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  type          job_type    NOT NULL,
  status        job_status  NOT NULL DEFAULT 'pending',
  payload       JSONB,
  result        JSONB,
  error         TEXT,
  attempts      INT         NOT NULL DEFAULT 0,
  max_attempts  INT         NOT NULL DEFAULT 3,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS jobs_user_status
  ON jobs (user_id, status, created_at DESC);

-- Auto-delete jobs older than 30 days (completed/failed/cancelled only).
-- This is enforced by the cron processor; no DB scheduler required.
