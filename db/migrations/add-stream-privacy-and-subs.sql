-- Stream privacy: public | unlisted | subscribers_only
-- Default 'public' to preserve existing stream behavior
ALTER TABLE users
ADD COLUMN IF NOT EXISTS stream_privacy VARCHAR(20) DEFAULT 'public';

-- Share token: random secret used as URL key for unlisted/subscribers-only streams
-- The creator can rotate this to invalidate all previously shared links
ALTER TABLE users
ADD COLUMN IF NOT EXISTS share_token VARCHAR(64);

-- Mux signed playback ID: used when stream is private (separate from public playback ID)
-- Streams may have BOTH a public and signed playback ID; we pick which to expose at runtime
ALTER TABLE users
ADD COLUMN IF NOT EXISTS mux_signed_playback_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_stream_privacy ON users(stream_privacy);
CREATE INDEX IF NOT EXISTS idx_users_share_token ON users(share_token);

-- Subscription tiers (creator-defined, for future paid subscriptions)
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  price_usdc NUMERIC(20, 7) NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 30,
  perks TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active subscriptions (one row per active subscription period)
-- Stellar does not support recurring billing natively, so each row is a one-time
-- time-bounded purchase. Renewal = creating a new row with new expires_at.
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES subscription_tiers(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  payment_tx_hash VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subs_active ON subscriptions(subscriber_id, creator_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subs_creator ON subscriptions(creator_id);
CREATE INDEX IF NOT EXISTS idx_subs_expires ON subscriptions(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_tiers_creator ON subscription_tiers(creator_id) WHERE active = TRUE;
