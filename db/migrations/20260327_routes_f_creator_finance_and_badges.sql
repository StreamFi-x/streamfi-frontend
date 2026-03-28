-- routes-f creator earnings, payouts, schedules, and badges support

DO $$ BEGIN
  CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payout_method AS ENUM ('bank_transfer', 'stellar_wallet', 'mobile_money');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, followee_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_followee_id ON user_follows(followee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON user_follows(follower_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tip_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount_xlm NUMERIC(20,7) NOT NULL,
  price_usd NUMERIC(20,7),
  tx_hash TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tip_transactions_creator_id ON tip_transactions(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tip_transactions_supporter_id ON tip_transactions(supporter_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tip_transactions_tx_hash_unique
  ON tip_transactions(tx_hash)
  WHERE tx_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS gift_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  gift_type TEXT,
  amount_usdc NUMERIC(10,2) NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_transactions_creator_id ON gift_transactions(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_supporter_id ON gift_transactions(supporter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount_usdc NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  interval_label TEXT NOT NULL DEFAULT 'monthly',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_charged_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_creator_id ON subscriptions(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_supporter_id ON subscriptions(supporter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_usdc NUMERIC(10,2) NOT NULL,
  method payout_method NOT NULL,
  destination TEXT NOT NULL,
  status payout_status NOT NULL DEFAULT 'pending',
  provider TEXT,
  provider_ref TEXT,
  fee_usdc NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_usdc NUMERIC(10,2) NOT NULL,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id, initiated_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status, initiated_at DESC);

CREATE TABLE IF NOT EXISTS stream_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_mins INT NOT NULL DEFAULT 120,
  status TEXT NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_schedule_creator_id ON stream_schedule(creator_id, scheduled_at ASC);
CREATE INDEX IF NOT EXISTS idx_stream_schedule_status ON stream_schedule(status, scheduled_at ASC);

CREATE TABLE IF NOT EXISTS stream_reminders (
  schedule_id UUID NOT NULL REFERENCES stream_schedule(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remind_at TIMESTAMPTZ NOT NULL,
  sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (schedule_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_stream_reminders_due ON stream_reminders(sent, remind_at);

CREATE TABLE IF NOT EXISTS badge_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  tier TEXT NOT NULL,
  sort_order INT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id, earned_at DESC);

INSERT INTO badge_definitions (id, name, description, icon, tier, sort_order)
VALUES
  ('first_stream', 'First Broadcast', 'Completed first live stream', 'broadcast', 'bronze', 1),
  ('first_tip', 'First Tip', 'Received first XLM tip', 'tip', 'bronze', 2),
  ('first_gift', 'Gift Received', 'Received first Dragon or Lion gift', 'gift', 'silver', 3),
  ('hundred_followers', 'Rising Star', 'Reached 100 followers', 'followers', 'silver', 4),
  ('thousand_followers', 'Community Builder', 'Reached 1,000 followers', 'community', 'gold', 5),
  ('ten_hours_streamed', 'Marathon Streamer', 'Streamed for 10 hours total', 'clock-10', 'silver', 6),
  ('hundred_hours_streamed', 'Veteran Broadcaster', 'Streamed for 100 hours total', 'clock-100', 'gold', 7),
  ('top_earner', 'Top Earner', 'Earned 1,000 USDC total', 'diamond', 'diamond', 8)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    tier = EXCLUDED.tier,
    sort_order = EXCLUDED.sort_order;
