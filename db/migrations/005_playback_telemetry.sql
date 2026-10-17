-- Playback telemetry tables for RUM data collection

-- Raw telemetry events (high-volume, time-series friendly)
CREATE TABLE IF NOT EXISTS playback_telemetry_events (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL UNIQUE,
    stream_id VARCHAR(255) NOT NULL,
    viewer_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'startup', 'rebuffer', 'quality_change', 'error', 'session_end'
    data JSONB NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying and aggregation
CREATE INDEX IF NOT EXISTS idx_playback_events_stream_time 
    ON playback_telemetry_events(stream_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_playback_events_session 
    ON playback_telemetry_events(session_id, event_type);

CREATE INDEX IF NOT EXISTS idx_playback_events_received_time 
    ON playback_telemetry_events(received_at DESC);

-- Session-level rollup (aggregated metrics per viewer session)
CREATE TABLE IF NOT EXISTS playback_session_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id VARCHAR(255) NOT NULL,
    viewer_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    
    startup_time_ms INTEGER,
    total_rebuffer_count INTEGER DEFAULT 0,
    total_rebuffer_duration_ms BIGINT DEFAULT 0,
    rebuffer_ratio NUMERIC(5, 4) DEFAULT 0, -- 0.0 to 1.0
    error_count INTEGER DEFAULT 0,
    session_duration_seconds INTEGER,
    
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_session_metrics_stream_time 
    ON playback_session_metrics(stream_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_metrics_viewer 
    ON playback_session_metrics(viewer_id, started_at DESC);

-- Hourly rollup (pre-aggregated for dashboards)
CREATE TABLE IF NOT EXISTS playback_metrics_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id VARCHAR(255) NOT NULL,
    hour_start TIMESTAMPTZ NOT NULL,
    
    session_count INTEGER DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    avg_startup_time_ms NUMERIC(10, 2),
    p50_startup_time_ms INTEGER,
    p95_startup_time_ms INTEGER,
    total_rebuffer_events INTEGER DEFAULT 0,
    avg_rebuffer_ratio NUMERIC(5, 4),
    error_rate NUMERIC(5, 4), -- 0.0 to 1.0
    total_errors INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stream_id, hour_start)
);

CREATE INDEX IF NOT EXISTS idx_metrics_hourly_stream_time 
    ON playback_metrics_hourly(stream_id, hour_start DESC);

-- Daily rollup
CREATE TABLE IF NOT EXISTS playback_metrics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id VARCHAR(255) NOT NULL,
    day_start TIMESTAMPTZ NOT NULL,
    
    session_count INTEGER DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    avg_startup_time_ms NUMERIC(10, 2),
    p50_startup_time_ms INTEGER,
    p95_startup_time_ms INTEGER,
    total_rebuffer_events INTEGER DEFAULT 0,
    avg_rebuffer_ratio NUMERIC(5, 4),
    error_rate NUMERIC(5, 4),
    total_errors INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stream_id, day_start)
);

CREATE INDEX IF NOT EXISTS idx_metrics_daily_stream_time 
    ON playback_metrics_daily(stream_id, day_start DESC);
