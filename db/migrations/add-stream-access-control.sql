-- Migration: add stream access control columns to users table
-- Run before deploying the token-gated streams feature.
--
-- stream_access_type: 'public' (default) or 'token_gated'
-- stream_access_config: JSONB containing the token gate settings:
--   { asset_code, asset_issuer, min_balance }

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stream_access_type TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS stream_access_config JSONB;

-- Constraint: only allow known access types
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS chk_stream_access_type;

ALTER TABLE users
  ADD CONSTRAINT chk_stream_access_type
  CHECK (stream_access_type IN ('public', 'token_gated'));

CREATE INDEX IF NOT EXISTS idx_users_stream_access_type
  ON users(stream_access_type);
