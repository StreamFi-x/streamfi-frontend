-- routes-f earnings support tables

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

CREATE INDEX IF NOT EXISTS idx_tip_transactions_creator_id
  ON tip_transactions(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tip_transactions_supporter_id
  ON tip_transactions(supporter_id, created_at DESC);
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

CREATE INDEX IF NOT EXISTS idx_gift_transactions_creator_id
  ON gift_transactions(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_supporter_id
  ON gift_transactions(supporter_id, created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_subscriptions_creator_id
  ON subscriptions(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_supporter_id
  ON subscriptions(supporter_id, created_at DESC);
