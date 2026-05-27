-- Add latency_mode column to users table
-- 'low' = low-latency (3-5s delay, no DVR/rewind)
-- 'standard' = standard latency (10-15s delay, DVR/rewind enabled)
-- Default to 'low' to preserve existing behavior
ALTER TABLE users
ADD COLUMN IF NOT EXISTS latency_mode VARCHAR(10) DEFAULT 'low';
