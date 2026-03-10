-- Migration: Add tip tracking columns to users table
-- Issue: #246
-- Description: Cache tip aggregates from Stellar Horizon API for faster dashboard display

ALTER TABLE users ADD COLUMN IF NOT EXISTS total_tips_received NUMERIC(20, 7) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_tips_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_tip_at TIMESTAMP;

COMMENT ON COLUMN users.total_tips_received IS 'Total XLM received via tips (cached from Horizon API)';
COMMENT ON COLUMN users.total_tips_count IS 'Number of tips received';
COMMENT ON COLUMN users.last_tip_at IS 'Timestamp of most recent tip';
