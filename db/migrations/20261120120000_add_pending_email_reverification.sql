-- Migration: add pending email reverification support
-- Idempotent: only add columns if they don't exist

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='pending_email') THEN
        ALTER TABLE users ADD COLUMN pending_email VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='pending_email_requested_at') THEN
        ALTER TABLE users ADD COLUMN pending_email_requested_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email_change_status') THEN
        ALTER TABLE users ADD COLUMN email_change_status VARCHAR(32) NOT NULL DEFAULT 'none';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email_change_failure_reason') THEN
        ALTER TABLE users ADD COLUMN email_change_failure_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='previous_verified_email') THEN
        ALTER TABLE users ADD COLUMN previous_verified_email VARCHAR(255);
    END IF;
END $$;

-- Partial index for case‑insensitive lookup of pending email
CREATE INDEX IF NOT EXISTS idx_users_pending_email_lower ON users (LOWER(pending_email)) WHERE pending_email IS NOT NULL;
