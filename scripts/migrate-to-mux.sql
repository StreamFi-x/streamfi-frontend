-- Migration script to update database schema from Livepeer to Mux
-- Run this on your PostgreSQL database

-- Add new Mux columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS mux_stream_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS mux_playback_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS mux_stream_key VARCHAR(255);

-- Update stream_sessions table
ALTER TABLE stream_sessions
ADD COLUMN IF NOT EXISTS mux_session_id VARCHAR(255);

-- Do not copy Livepeer IDs into the mux_* columns: they are different
-- providers' identifiers and Mux rejects them. Legacy columns are archived and
-- dropped by db/migrations/20260925190100_retire_livepeer_columns.sql (#1408).

-- Verify the changes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name LIKE '%mux%'
ORDER BY column_name;
