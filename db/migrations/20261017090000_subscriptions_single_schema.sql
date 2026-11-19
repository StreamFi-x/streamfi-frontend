-- One subscriptions schema (#726).
--
-- 20260926130100_subscription_cancellation_refunds.sql settled on the
-- subscriber_id / creator_id / expires_at / payment_tx_hash / amount_usdc shape
-- and copied legacy values across once. Two gaps remain on environments whose
-- table was first created by db/schema.sql or the routes-f finance migration:
--
--   1. Legacy columns that were NOT NULL (price_usdc, current_period_end, ...)
--      are no longer written by the application, so inserts into those tables
--      fail.
--   2. Rows written by code that still used a legacy column after the first
--      backfill have a NULL canonical column, which stream-access treats as
--      "no active subscription".
--
-- Legacy columns are kept (nothing is dropped, no data is lost); they just stop
-- being required and are backfilled one more time. Safe to run on any shape.

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
      EXECUTE format(
        'ALTER TABLE subscriptions ALTER COLUMN %I DROP NOT NULL',
        alias.legacy
      );
    END IF;
  END LOOP;
END $$;
