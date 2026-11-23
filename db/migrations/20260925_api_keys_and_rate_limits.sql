-- Migration: add api_keys table for third-party & developer API keys with rate-limit tiering
-- Run against your Vercel Postgres / Neon database.

CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(100) NOT NULL,
  key_prefix   VARCHAR(24)  NOT NULL,          -- e.g. "sf_live_a1b2..."
  key_hash     VARCHAR(64)  NOT NULL UNIQUE,   -- SHA-256 hex digest of raw secret key
  tier         VARCHAR(20)  NOT NULL DEFAULT 'free', -- 'free' | 'creator' | 'partner'
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ
);

-- Index for instant key validation lookup by token hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- Composite index for listing active/revoked keys per user account
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id, revoked_at);
