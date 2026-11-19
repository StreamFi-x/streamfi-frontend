-- Issue #1374: Time-series rollup storage and historical trend charts for platform metrics
-- Creates tables to store daily/hourly aggregations of key platform metrics
-- Enables trend analysis and historical visibility into DAU, MAU, tip volume, streaming hours

-- Metric definitions versioning (frozen definitions to handle metric changes over time)
CREATE TABLE IF NOT EXISTS metric_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  computation_query TEXT,
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'deprecated', 'archived'
  defined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deprecated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metric_definitions_key ON metric_definitions(key);
CREATE INDEX IF NOT EXISTS idx_metric_definitions_status ON metric_definitions(status);

-- Hourly metric rollup: per-metric snapshots captured hourly
CREATE TABLE IF NOT EXISTS platform_metrics_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key VARCHAR(100) NOT NULL,
  metric_version INT NOT NULL,
  hour_timestamp TIMESTAMPTZ NOT NULL,  -- rounded down to hour
  value NUMERIC(20, 4) NOT NULL,
  value_type VARCHAR(20) NOT NULL DEFAULT 'count', -- 'count', 'sum', 'average', 'ratio'
  dimension_data JSONB DEFAULT '{}', -- optional: breakdown by creator, category, etc.
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_metrics_hourly_unique 
  ON platform_metrics_hourly(metric_key, metric_version, hour_timestamp);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_hourly_timestamp 
  ON platform_metrics_hourly(hour_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_hourly_metric_time 
  ON platform_metrics_hourly(metric_key, hour_timestamp DESC);

-- Daily metric rollup: aggregated from hourly data or computed fresh
CREATE TABLE IF NOT EXISTS platform_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key VARCHAR(100) NOT NULL,
  metric_version INT NOT NULL,
  day_timestamp DATE NOT NULL,
  value NUMERIC(20, 4) NOT NULL,
  value_type VARCHAR(20) NOT NULL DEFAULT 'count',
  dimension_data JSONB DEFAULT '{}',
  source VARCHAR(50) NOT NULL DEFAULT 'aggregated', -- 'aggregated' or 'computed'
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_metrics_daily_unique 
  ON platform_metrics_daily(metric_key, metric_version, day_timestamp);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_daily_timestamp 
  ON platform_metrics_daily(day_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_daily_metric_time 
  ON platform_metrics_daily(metric_key, day_timestamp DESC);

-- Monthly metric rollup: for long-term trend storage
CREATE TABLE IF NOT EXISTS platform_metrics_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key VARCHAR(100) NOT NULL,
  metric_version INT NOT NULL,
  month_timestamp DATE NOT NULL,  -- first day of month
  value NUMERIC(20, 4) NOT NULL,
  value_type VARCHAR(20) NOT NULL DEFAULT 'count',
  dimension_data JSONB DEFAULT '{}',
  source VARCHAR(50) NOT NULL DEFAULT 'aggregated',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_metrics_monthly_unique 
  ON platform_metrics_monthly(metric_key, metric_version, month_timestamp);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_monthly_timestamp 
  ON platform_metrics_monthly(month_timestamp DESC);

-- Metric capture job tracking: prevents duplicate captures and enables recovery
CREATE TABLE IF NOT EXISTS metric_capture_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key VARCHAR(100) NOT NULL,
  granularity VARCHAR(20) NOT NULL, -- 'hourly', 'daily', 'monthly'
  target_timestamp TIMESTAMPTZ NOT NULL,  -- hour or day being captured
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
  rows_captured INT NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(metric_key, granularity, target_timestamp)
);

CREATE INDEX IF NOT EXISTS idx_metric_capture_status 
  ON metric_capture_jobs(status, granularity, target_timestamp);

-- Insert standard metric definitions
INSERT INTO metric_definitions (key, name, description, version, status)
VALUES
  ('dau', 'Daily Active Users', 'Distinct users with any activity in a day', 1, 'active'),
  ('mau', 'Monthly Active Users', 'Distinct users with any activity in a month', 1, 'active'),
  ('live_streams', 'Live Streams Count', 'Number of currently live streams', 1, 'active'),
  ('tips_volume_xlm', 'Tips Volume (XLM)', 'Total XLM tips sent in period', 1, 'active'),
  ('tips_volume_usd', 'Tips Volume (USD)', 'Total USD-equivalent tips sent in period', 1, 'active'),
  ('stream_hours', 'Total Stream Hours', 'Cumulative hours of streaming in period', 1, 'active'),
  ('new_creators', 'New Creators', 'Creators who started their first stream in period', 1, 'active'),
  ('total_followers', 'Total Followers', 'Total follower relationships in period', 1, 'active')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE platform_metrics_hourly IS 'Hourly snapshots of key platform metrics. Used for detailed trend analysis and alerts.';
COMMENT ON TABLE platform_metrics_daily IS 'Daily aggregations of platform metrics. Primary table for trend charts.';
COMMENT ON TABLE platform_metrics_monthly IS 'Monthly aggregations for long-term trend storage and archival.';
COMMENT ON TABLE metric_definitions IS 'Frozen metric definitions with versioning. Allows metrics to evolve without breaking historical data.';
