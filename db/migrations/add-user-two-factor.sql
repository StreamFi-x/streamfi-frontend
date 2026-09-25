-- Migration: add user_two_factor table backing the routes-f 2FA endpoints
-- (2fa/setup, 2fa/verify, 2fa/disable, 2fa/status, auth-2fa-confirm, and the
-- new auth-2fa-enable / auth-2fa-disable / auth-recovery-codes-generate
-- routes). These routes already query this table in production code; this
-- migration was missing from db/migrations, so add it now rather than
-- leaving the schema undocumented.
-- Run once against your Vercel Postgres / Neon database.

CREATE TABLE IF NOT EXISTS user_two_factor (
  user_id                 UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  totp_secret_ciphertext  TEXT,                 -- AES-256-GCM ciphertext, base64
  totp_secret_iv          TEXT,                 -- AES-256-GCM IV, base64
  totp_secret_tag         TEXT,                 -- AES-256-GCM auth tag, base64
  totp_enabled            BOOLEAN     NOT NULL DEFAULT false,
  backup_code_hashes      TEXT,                 -- JSON array of SHA-256 hex hashes (recovery codes)
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
