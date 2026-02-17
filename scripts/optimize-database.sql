-- Performance Optimization: Add Database Indexes
-- Run this SQL script to significantly improve query performance

-- Index on wallet for faster user lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(LOWER(wallet));

-- Index on mux_stream_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_users_mux_stream_id ON users(mux_stream_id);

-- Index on mux_playback_id for stream queries
CREATE INDEX IF NOT EXISTS idx_users_mux_playback_id ON users(mux_playback_id);

-- Index on is_live for filtering live streams
CREATE INDEX IF NOT EXISTS idx_users_is_live ON users(is_live) WHERE is_live = true;

-- Composite index for common stream queries
CREATE INDEX IF NOT EXISTS idx_users_wallet_live ON users(LOWER(wallet), is_live);

-- Index on stream_sessions for faster session lookups
CREATE INDEX IF NOT EXISTS idx_stream_sessions_user_id ON stream_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_mux_session_id ON stream_sessions(mux_session_id);

-- Index on username for search functionality
CREATE INDEX IF NOT EXISTS idx_users_username ON users(LOWER(username));

-- Analyze tables to update statistics for query planner
ANALYZE users;
ANALYZE stream_sessions;

-- Vacuum to reclaim storage and optimize performance
VACUUM ANALYZE users;
VACUUM ANALYZE stream_sessions;
