-- Exchange-rate quotes: lock rates at tip initiation to prevent price-move exploitation
-- Supports 5-minute quote lifetime with audit trail (issued, consumed, expired)

CREATE TABLE IF NOT EXISTS exchange_rate_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quoted_rate NUMERIC(20, 10) NOT NULL,
  quoted_xlm_amount NUMERIC(20, 7) NOT NULL,
  fiat_amount_cents INTEGER NOT NULL,
  quote_token TEXT UNIQUE NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'consumed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_quotes_creator_id 
  ON exchange_rate_quotes(creator_id);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_quotes_quote_token 
  ON exchange_rate_quotes(quote_token) 
  WHERE status = 'issued';

CREATE INDEX IF NOT EXISTS idx_exchange_rate_quotes_expires_at 
  ON exchange_rate_quotes(expires_at) 
  WHERE status = 'issued';

COMMENT ON TABLE exchange_rate_quotes IS 'Time-limited exchange rate locks for tip transactions, preventing price-slip exploitation';
COMMENT ON COLUMN exchange_rate_quotes.quote_token IS '64-char hex token, unique and non-guessable, used to redeem quote at payment time';
COMMENT ON COLUMN exchange_rate_quotes.quoted_rate IS 'XLM/USD spot rate (e.g., 0.45) locked when quote issued';
COMMENT ON COLUMN exchange_rate_quotes.quoted_xlm_amount IS 'XLM amount (e.g., 10.5000000) locked in this quote';
COMMENT ON COLUMN exchange_rate_quotes.fiat_amount_cents IS 'USD cents equivalent (e.g., 472 = $4.72) locked in this quote';
COMMENT ON COLUMN exchange_rate_quotes.consumed_at IS 'When this quote was redeemed via tip submission; null if not yet consumed';
COMMENT ON COLUMN exchange_rate_quotes.status IS 'issued=active, consumed=tip confirmed, expired=TTL exceeded or marked stale';
