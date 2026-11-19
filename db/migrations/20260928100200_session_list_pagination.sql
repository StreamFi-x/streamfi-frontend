CREATE INDEX IF NOT EXISTS user_sessions_active_pagination
  ON user_sessions (user_id, last_seen_at DESC, id DESC)
  WHERE revoked = false;