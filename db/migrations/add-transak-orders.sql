-- Migration: add transak_orders table
-- Run this against the production database before deploying the Transak integration.

CREATE TABLE IF NOT EXISTS transak_orders (
  id              TEXT PRIMARY KEY,           -- Transak-assigned order ID
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  status          TEXT NOT NULL,
  crypto_amount   NUMERIC,
  crypto_currency TEXT,
  fiat_amount     NUMERIC,
  fiat_currency   TEXT,
  wallet_address  TEXT,
  tx_hash         TEXT,                        -- On-chain transaction hash (set when COMPLETED)
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transak_orders_user_id   ON transak_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_transak_orders_status    ON transak_orders(status);
CREATE INDEX IF NOT EXISTS idx_transak_orders_wallet    ON transak_orders(wallet_address);
CREATE INDEX IF NOT EXISTS idx_transak_orders_created   ON transak_orders(created_at DESC);
