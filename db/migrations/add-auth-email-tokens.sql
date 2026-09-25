-- Migration: add password_reset_tokens, email_verification_tokens, and
-- magic_link_tokens tables for the email-based auth routes (routes-f auth-*).
-- Run once against your Vercel Postgres / Neon database.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT        NOT NULL UNIQUE,   -- SHA-256 hex of the raw token
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user
  ON password_reset_tokens(user_id, consumed_at, expires_at);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email        VARCHAR(255) NOT NULL,
  token_hash   TEXT        NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS email_verification_tokens_user
  ON email_verification_tokens(user_id, consumed_at, expires_at);

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT        NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS magic_link_tokens_user
  ON magic_link_tokens(user_id, consumed_at, expires_at);
