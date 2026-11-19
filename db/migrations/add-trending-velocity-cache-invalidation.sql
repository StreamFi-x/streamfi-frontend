-- Trending Velocity Algorithm & Cache Invalidation Infrastructure

-- Add computed follower_count to users table (denormalized for faster queries)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS follower_count INTEGER GENERATED ALWAYS AS (
  COALESCE(array_length(followers, 1), 0)
) STORED;

-- Create trigram index on username for fuzzy search (pg_trgm extension required)
-- This enables similarity() function used in search-username endpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_users_username_trgm ON users USING GIN (username gin_trgm_ops);

-- Viewer count snapshots for velocity calculation
-- Captures viewer count at regular intervals to compute rate-of-change trending
CREATE TABLE IF NOT EXISTS viewer_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
    viewer_count INTEGER NOT NULL,
    snapshot_time TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient trending calculations
CREATE INDEX IF NOT EXISTS idx_viewer_snapshots_user_id ON viewer_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_viewer_snapshots_snapshot_time ON viewer_snapshots(snapshot_time DESC);
CREATE INDEX IF NOT EXISTS idx_viewer_snapshots_user_time ON viewer_snapshots(user_id, snapshot_time DESC);

-- Materialized trending results (refreshed periodically by cron job)
-- Stores pre-computed trending rankings to avoid expensive calculations on every request
CREATE TABLE IF NOT EXISTS trending_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    viewer_count INTEGER NOT NULL,
    velocity_score NUMERIC(10, 4) NOT NULL,  -- Normalized rate-of-change (-1 to 1)
    current_viewers INTEGER DEFAULT 0,
    follower_count INTEGER DEFAULT 0,
    is_live BOOLEAN DEFAULT FALSE,
    last_computed TIMESTAMPTZ DEFAULT now(),
    window_hours INTEGER DEFAULT 24,
    UNIQUE(user_id, window_hours)
);

CREATE INDEX IF NOT EXISTS idx_trending_channels_rank ON trending_channels(window_hours, rank);
CREATE INDEX IF NOT EXISTS idx_trending_channels_velocity ON trending_channels(window_hours, velocity_score DESC);
CREATE INDEX IF NOT EXISTS idx_trending_channels_last_computed ON trending_channels(last_computed DESC);

-- Cache invalidation tracking
-- Maps cached query keys to the user IDs that affect them for targeted invalidation
CREATE TABLE IF NOT EXISTS search_cache_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tag_type TEXT DEFAULT 'user',  -- 'user' | 'stream' | 'category'
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_cache_tags_user_id ON search_cache_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_search_cache_tags_cache_key ON search_cache_tags(cache_key);

-- Event log for cache invalidations (audit trail)
CREATE TABLE IF NOT EXISTS cache_invalidation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,  -- 'live_status_change' | 'user_update' | 'manual_purge'
    affected_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    cache_keys_invalidated TEXT[],  -- Array of cache keys that were purged
    reason TEXT,
    triggered_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cache_invalidation_log_user_id ON cache_invalidation_log(affected_user_id);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_log_triggered_at ON cache_invalidation_log(triggered_at DESC);
