-- Candidate indexes for the chat poll path, applied between benchmark runs.
CREATE INDEX IF NOT EXISTS idx_users_mux_playback_id ON users(mux_playback_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_open_by_user
  ON stream_sessions(user_id, started_at DESC) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_window
  ON chat_messages(stream_session_id, created_at DESC) WHERE is_deleted = false;
ANALYZE;
