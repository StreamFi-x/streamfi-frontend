-- Performance Optimization: Add Database Indexes
-- Run this SQL script to significantly improve query performance

-- Wallet lookups: exact match uses the UNIQUE(wallet) index (users_wallet_key);
-- LOWER(wallet) lookups use idx_users_wallet_lower from
-- db/migrations/20260926100200_hot_path_indexes.sql. A separate idx_users_wallet
-- would duplicate the unique index, so it is no longer created here.

-- Index on mux_stream_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_users_mux_stream_id ON users(mux_stream_id);

-- Index on mux_playback_id for stream queries
CREATE INDEX IF NOT EXISTS idx_users_mux_playback_id ON users(mux_playback_id);

-- Index on is_live for filtering live streams
CREATE INDEX IF NOT EXISTS idx_users_is_live ON users(is_live) WHERE is_live = true;

-- Composite index for common stream queries
CREATE INDEX IF NOT EXISTS idx_users_wallet_live ON users(wallet, is_live);

-- Index on stream_sessions for faster session lookups
CREATE INDEX IF NOT EXISTS idx_stream_sessions_user_id ON stream_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_mux_session_id ON stream_sessions(mux_session_id);

-- Case-insensitive username lookups (LOWER(username) = LOWER($1)).
-- Previously created as idx_users_username, the same name db/schema.sql uses
-- for a plain username index; under IF NOT EXISTS whichever ran first won.
-- Named consistently with db/migrations/20260926100200_hot_path_indexes.sql.
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));

-- Analyze tables to update statistics for query planner
ANALYZE users;
ANALYZE stream_sessions;

-- Vacuum to reclaim storage and optimize performance
VACUUM ANALYZE users;
VACUUM ANALYZE stream_sessions;
