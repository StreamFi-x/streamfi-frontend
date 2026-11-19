-- Subscription cancellation and refund requests (#1426).
--
-- The subscriptions table was created by three legacy files with different
-- column names (db/schema.sql, add-stream-privacy-and-subs.sql and
-- 20260327_routes_f_creator_finance_and_badges.sql). This migration settles on
-- the add-stream-privacy-and-subs.sql shape (one row per paid period:
-- subscriber_id, creator_id, started_at, expires_at, payment_tx_hash) and
-- fills those columns from the legacy aliases where they are empty. Legacy
-- columns are left in place for the code that still reads them.

CREATE TABLE IF NOT EXISTS subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id   UUID REFERENCES users(id) ON DELETE RESTRICT,
  creator_id      UUID REFERENCES users(id) ON DELETE RESTRICT,
  tier_id         UUID,
  started_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  payment_tx_hash VARCHAR(255),
  amount_usdc     NUMERIC(20, 7),
  status          VARCHAR(20) DEFAULT 'active',
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS subscriber_id UUID;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS creator_id UUID;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_tx_hash VARCHAR(255);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS amount_usdc NUMERIC(20, 7);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
-- Set when the subscriber turns renewal off. Access is unaffected.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewal_cancelled_at TIMESTAMPTZ;
-- Set when a refund for this period is completed; access ends at that moment.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

DO $$
DECLARE
  alias record;
BEGIN
  FOR alias IN
    SELECT * FROM (VALUES
      ('subscriber_id',   'supporter_id'),
      ('creator_id',      'streamer_id'),
      ('expires_at',      'current_period_end'),
      ('payment_tx_hash', 'tx_hash'),
      ('amount_usdc',     'price_usdc')
    ) AS a(canonical, legacy)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = 'subscriptions'::regclass
        AND attname = alias.legacy
        AND NOT attisdropped
    ) THEN
      EXECUTE format(
        'UPDATE subscriptions SET %I = %I WHERE %I IS NULL AND %I IS NOT NULL',
        alias.canonical, alias.legacy, alias.canonical, alias.legacy
      );
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber_period
  ON subscriptions (subscriber_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS subscription_refund_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID        NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
  subscriber_id    UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  creator_id       UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- Snapshot of the payment being refunded, so later edits to the
  -- subscription row cannot change what was requested.
  payment_tx_hash  TEXT,
  amount_usdc      NUMERIC(20, 7),
  reason           TEXT        NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
  within_window    BOOLEAN     NOT NULL,
  -- A creator payout started after this payment, so the funds may already
  -- have left the creator's earnings. Such requests always need review and
  -- are platform-funded if approved.
  payout_occurred  BOOLEAN     NOT NULL,
  funding_source   TEXT        NOT NULL CHECK (funding_source IN ('creator_earnings', 'platform')),
  status           TEXT        NOT NULL CHECK (status IN ('pending_review', 'approved', 'rejected', 'completed')),
  auto_approved    BOOLEAN     NOT NULL DEFAULT false,
  decision_note    TEXT,
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  -- The separate outbound Stellar payment that returned the funds. The
  -- original payment is never reversed.
  refund_tx_hash   TEXT        UNIQUE,
  completed_by     TEXT,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One refund request per paid period, whatever its outcome.
  CONSTRAINT subscription_refund_requests_one_per_period UNIQUE (subscription_id),
  CONSTRAINT subscription_refund_requests_completion CHECK (
    (status = 'completed') = (refund_tx_hash IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_status
  ON subscription_refund_requests (status, created_at);
CREATE INDEX IF NOT EXISTS idx_refund_requests_subscriber
  ON subscription_refund_requests (subscriber_id, created_at DESC);
