-- Issue #1373: Replace live COUNT(*) admin analytics queries with materialized rollup
-- Creates materialized views and rollup tables for admin analytics metrics
-- Allows efficient querying of aggregated metrics without expensive full-table scans

-- Admin analytics rollup table: daily snapshots of key platform metrics
CREATE TABLE IF NOT EXISTS admin_analytics_daily_rollup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL,
  total_users_active INT NOT NULL DEFAULT 0,
  total_users_banned INT NOT NULL DEFAULT 0,
  live_streams_count INT NOT NULL DEFAULT 0,
  pending_stream_reports INT NOT NULL DEFAULT 0,
  pending_bug_reports INT NOT NULL DEFAULT 0,
  new_users_count INT NOT NULL DEFAULT 0,
  total_categories INT NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(metric_date)
);

CREATE INDEX IF NOT EXISTS idx_admin_analytics_daily_date 
  ON admin_analytics_daily_rollup(metric_date DESC);

-- Materialized view for latest admin analytics (uses latest rollup data)
-- This view is refreshed by the cron job and serves the /api/admin/analytics endpoint
CREATE OR REPLACE VIEW admin_analytics_current AS
SELECT
  (SELECT COUNT(*) FROM users WHERE is_banned = false) AS total_users,
  (SELECT COUNT(*) FROM users WHERE is_live = true) AS live_now,
  (SELECT COUNT(*) FROM stream_reports WHERE status = 'pending') AS pending_stream_reports,
  (SELECT COUNT(*) FROM bug_reports WHERE status = 'pending') AS pending_bug_reports,
  (SELECT COUNT(*) FROM users WHERE created_at > now() - INTERVAL '7 days') AS new_users_7d,
  (SELECT COUNT(*) FROM stream_categories) AS total_categories,
  NOW() AS computed_at;

-- Create unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_analytics_current_unique
  ON admin_analytics_daily_rollup(metric_date DESC)
  WHERE metric_date = CURRENT_DATE;

-- Add to the list of views that are periodically refreshed
-- (see lib/routes-f/admin-analytics.ts for refresh job)
COMMENT ON TABLE admin_analytics_daily_rollup IS 'Daily rollup of admin dashboard metrics. Captured once per day and used for historical trend analysis.';
