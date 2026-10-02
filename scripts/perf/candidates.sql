-- Builds every candidate index with CREATE INDEX CONCURRENTLY (timed) and reports sizes.
-- Run with psql in autocommit mode (NOT -1): psql -f scripts/perf/candidates.sql
-- Candidates are evaluated with scripts/perf/run-explain.sh before / after this file.
-- idx_users_live_viewers and idx_users_is_banned are evaluated separately
-- (see README: run-loadtest.sh hot, and the is_banned block at the end of this file).
\set ON_ERROR_STOP on
\timing on

\echo '>> idx_users_username_lower'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
\echo '>> idx_users_wallet_lower'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_wallet_lower ON users (LOWER(wallet));
\echo '>> idx_users_email_lower'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
\echo '>> idx_users_mux_playback_id'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_mux_playback_id ON users (mux_playback_id);
\echo '>> idx_chat_messages_session_keyset'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_session_keyset ON chat_messages (stream_session_id, created_at DESC, id DESC) WHERE is_deleted = false;
\echo '>> idx_stream_sessions_active_user'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_sessions_active_user ON stream_sessions (user_id, started_at DESC) WHERE ended_at IS NULL;
\echo '>> idx_stream_clips_ready_keyset'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_clips_ready_keyset ON stream_clips (created_at DESC, id DESC) WHERE status = 'ready';
\echo '>> idx_stream_clips_streamer_ready_keyset'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_clips_streamer_ready_keyset ON stream_clips (streamer_id, created_at DESC, id DESC) WHERE status = 'ready';
\echo '>> idx_stream_recordings_user_keyset'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_recordings_user_keyset ON stream_recordings (user_id, created_at DESC, id DESC);
\echo '>> idx_stream_whitelist_streamer_keyset'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_whitelist_streamer_keyset ON stream_whitelist (streamer_id, created_at DESC, id DESC);
\echo '>> idx_users_live_viewers'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_live_viewers ON users (current_viewers DESC) WHERE is_live;

\timing off
-- CONCURRENTLY does not collect statistics for expression indexes; without this the
-- planner keeps the default 0.5% selectivity guess for LOWER(col) = $1.
ANALYZE users;

SELECT c.relname AS index_name, t.relname AS table_name,
       pg_relation_size(c.oid) AS bytes, pg_size_pretty(pg_relation_size(c.oid)) AS size,
       i.indisvalid AS valid
FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid JOIN pg_class t ON t.oid = i.indrelid
WHERE c.relname IN ('idx_users_username_lower','idx_users_wallet_lower','idx_users_email_lower',
  'idx_users_mux_playback_id','idx_chat_messages_session_keyset','idx_stream_sessions_active_user',
  'idx_stream_clips_ready_keyset','idx_stream_clips_streamer_ready_keyset',
  'idx_stream_recordings_user_keyset','idx_stream_whitelist_streamer_keyset','idx_users_live_viewers',
  -- existing indexes the candidates may make redundant
  'idx_users_username','users_username_key','idx_chat_messages_not_deleted','idx_chat_messages_stream_session',
  'idx_stream_sessions_user_id','idx_stream_clips_status','idx_stream_clips_streamer',
  'idx_stream_recordings_user_id','idx_stream_whitelist_streamer','idx_users_is_live','idx_users_wallet','users_wallet_key')
ORDER BY t.relname, c.relname;
