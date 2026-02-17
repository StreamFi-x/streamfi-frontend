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

-- Optional: Migrate existing data (if you have existing Livepeer streams)
-- UPDATE users
-- SET mux_stream_id = livepeer_stream_id,
--     mux_playback_id = playback_id
-- WHERE livepeer_stream_id IS NOT NULL;

-- Optional: After migration is complete and verified, you can remove old columns
-- ALTER TABLE users DROP COLUMN IF EXISTS livepeer_stream_id;
-- ALTER TABLE stream_sessions DROP COLUMN IF EXISTS livepeer_session_id;

-- Verify the changes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name LIKE '%mux%'
ORDER BY column_name;
