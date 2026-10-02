-- Migration: add user_sessions table for active session tracking & revocation
-- Run once against your Vercel Postgres / Neon database.

CREATE TABLE IF NOT EXISTS user_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT        NOT NULL UNIQUE,   -- SHA-256 hex of the raw session token
  ip_address   INET,
  user_agent   TEXT,
  device_hint  TEXT,                          -- e.g. "Chrome on macOS"
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked      BOOLEAN     NOT NULL DEFAULT false
);

-- Composite index used by every auth check and the list-sessions query
CREATE INDEX IF NOT EXISTS user_sessions_user
  ON user_sessions(user_id, revoked, expires_at);

-- Unique index on token_hash already implied by UNIQUE constraint above,
-- but an explicit index name makes it easier to reference in EXPLAIN plans.
CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_token_hash
  ON user_sessions(token_hash);
