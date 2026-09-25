-- Indexes for the chat poll path (GET /api/streams/chat), issue #1410.
-- Measured in docs/postgres-pooling-and-chat-load.md: sustainable poll rate on
-- the benchmark box rose from ~2,400/s to ~3,600/s, and p95 at 2,000 polls/s
-- fell from 23 ms to 4 ms.
--
-- CONCURRENTLY avoids blocking chat writes while building, so run this file
-- outside a transaction block (psql -f does that by default). Rerunnable.
-- If a build is interrupted, drop the INVALID index and rerun.

-- Session lookup: WHERE u.mux_playback_id = $1 (also in scripts/optimize-database.sql)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_mux_playback_id
  ON users(mux_playback_id);

-- Open session per streamer, newest first; the table otherwise needs a
-- sequential scan that grows with every past broadcast.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_sessions_open_by_user
  ON stream_sessions(user_id, started_at DESC) WHERE ended_at IS NULL;

-- Newest N visible messages of one session without sorting the whole chat.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_session_window
  ON chat_messages(stream_session_id, created_at DESC) WHERE is_deleted = false;
