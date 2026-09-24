-- ─── Concurrent Viewer Cache (#1382) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS concurrent_viewer_cache (
    id VARCHAR(255) PRIMARY KEY,
    total_concurrent INTEGER NOT NULL DEFAULT 0,
    breakdown_json TEXT NOT NULL DEFAULT '[]', -- JSON array of {stream_id, viewer_count}
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_concurrent_viewer_cache_updated ON concurrent_viewer_cache(last_updated);

-- ─── Experiments & A/B Testing Framework (#1381) ──────────────────────────────

-- Experiment definitions
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'planning',
    variants TEXT NOT NULL, -- JSON array of variant names
    variant_weights TEXT NOT NULL, -- JSON object of {variant: weight (0-100)}
    started_at TIMESTAMP WITH TIME ZONE,
    concluded_at TIMESTAMP WITH TIME ZONE,
    excluded_user_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_experiments_key ON experiments(key);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);

-- User variant assignments (sticky, deterministic)
CREATE TABLE IF NOT EXISTS user_experiment_assignments (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    variant VARCHAR(50) NOT NULL, -- 'control', 'treatment_a', 'treatment_b', 'excluded'
    stable_hash VARCHAR(64) NOT NULL, -- HMAC for consistency verification
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, experiment_id)
);

CREATE INDEX IF NOT EXISTS idx_user_experiment_assignments_experiment ON user_experiment_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_user_experiment_assignments_variant ON user_experiment_assignments(variant);

-- Experiment outcome events
CREATE TABLE IF NOT EXISTS experiment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- e.g., 'view', 'click', 'conversion', 'signup'
    event_data JSONB DEFAULT '{}', -- Flexible event-specific data
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_experiment_events_user ON experiment_events(user_id);
CREATE INDEX IF NOT EXISTS idx_experiment_events_experiment ON experiment_events(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_events_event_type ON experiment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_experiment_events_recorded_at ON experiment_events(recorded_at);

-- Composite index for typical metrics queries (experiment + event_type)
CREATE INDEX IF NOT EXISTS idx_experiment_events_exp_event_type ON experiment_events(experiment_id, event_type);
