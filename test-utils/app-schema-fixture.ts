/**
 * Minimal application schema for integration tests: the pre-existing tables
 * these features touch (shapes copied from db/schema.sql and the legacy
 * migrations), followed by this repository's versioned migrations applied
 * from db/migrations, so the tests also exercise the real migration files.
 */
import { readdirSync, readFileSync } from "fs";
import path from "path";
import type { Pool } from "pg";
import {
  VERSIONED_FILENAME,
  isTransactional,
} from "@/lib/migrations/discovery";
import { splitSqlStatements } from "@/lib/migrations/sql-splitter";

const BASE_SCHEMA = `
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE,
  wallet VARCHAR(255) UNIQUE NOT NULL,
  email TEXT,
  is_live BOOLEAN DEFAULT FALSE,
  stream_started_at TIMESTAMPTZ,
  current_viewers INTEGER DEFAULT 0,
  mux_stream_id VARCHAR(255),
  mux_playback_id VARCHAR(255),
  creator JSONB,
  total_tips_received NUMERIC(20, 7) DEFAULT 0,
  total_tips_count INTEGER DEFAULT 0,
  last_tip_at TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stream_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mux_session_id VARCHAR(255),
  title VARCHAR(255),
  playback_id VARCHAR(255),
  started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER ELSE NULL END
  ) STORED,
  peak_viewers INTEGER DEFAULT 0,
  total_unique_viewers INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
  content TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stream_viewers (
  id SERIAL PRIMARY KEY,
  stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMPTZ
);

CREATE TABLE tip_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount_xlm NUMERIC(20,7) NOT NULL,
  price_usd NUMERIC(20,7),
  tx_hash TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_tip_transactions_tx_hash_unique
  ON tip_transactions(tx_hash) WHERE tx_hash IS NOT NULL;

CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE payout_method AS ENUM ('bank_transfer', 'stellar_wallet', 'mobile_money');
CREATE TABLE payouts (
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
`;

export async function applyAppSchema(pool: Pool): Promise<void> {
  await pool.query(BASE_SCHEMA);
  const dir = path.join(process.cwd(), "db", "migrations");
  const versioned = readdirSync(dir)
    .filter(file => VERSIONED_FILENAME.test(file))
    .sort();
  for (const file of versioned) {
    const sql = readFileSync(path.join(dir, file), "utf8");
    if (isTransactional(sql)) {
      await pool.query(sql);
      continue;
    }
    // Like the runner: `-- migrate:no-transaction` files (e.g. CREATE INDEX
    // CONCURRENTLY) run one statement at a time, outside a transaction block.
    for (const statement of splitSqlStatements(sql)) {
      await pool.query(statement);
    }
  }
}
