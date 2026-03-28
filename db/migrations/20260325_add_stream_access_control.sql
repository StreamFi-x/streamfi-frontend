-- Foundation for all private/restricted stream access features.
-- Part of issue #372 [access-control 1/5]

-- 1. Create stream_access_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stream_access_type') THEN
        CREATE TYPE stream_access_type AS ENUM (
            'public',        -- anyone can watch (default)
            'password',      -- requires a password
            'invite_only',   -- streamer manually whitelists viewers
            'paid',          -- viewer pays a one-time USDC fee
            'token_gated',   -- viewer must hold a specific Stellar asset
            'subscription'   -- viewer must have an active subscription
        );
    END IF;
END$$;

-- 2. Add columns to users table (streamers/creators data)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stream_access_type stream_access_type NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS stream_access_config JSONB;

-- 3. Create stream_access_grants table
-- Stores who has been explicitly granted access (used by invite_only and paid).
CREATE TABLE IF NOT EXISTS stream_access_grants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  streamer_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  viewer_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  access_type  stream_access_type NOT NULL,
  -- For paid: store the tx hash as proof of payment
  tx_hash      TEXT,
  granted_at   TIMESTAMPTZ DEFAULT now(),
  expires_at   TIMESTAMPTZ,   -- NULL = permanent
  UNIQUE(streamer_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS stream_access_grants_lookup
  ON stream_access_grants(streamer_id, viewer_id);
