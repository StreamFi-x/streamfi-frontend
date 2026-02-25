-- Optional stream recording: user preference + recordings table
-- Run after schema.sql / migrate-to-mux.sql

-- 1. User preference: record live streams (default false to avoid unexpected storage cost)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS enable_recording BOOLEAN DEFAULT false;

-- 2. stream_sessions: add title/playback_id if missing (used by webhook and recordings)
ALTER TABLE stream_sessions
ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE stream_sessions
ADD COLUMN IF NOT EXISTS playback_id VARCHAR(255);

-- 3. Recordings table (one row per Mux asset / VOD)
CREATE TABLE IF NOT EXISTS stream_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE SET NULL,
    mux_asset_id VARCHAR(255) NOT NULL,
    playback_id VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'processing',
    UNIQUE(mux_asset_id)
);

CREATE INDEX IF NOT EXISTS idx_stream_recordings_user_id ON stream_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_recordings_playback_id ON stream_recordings(playback_id);
CREATE INDEX IF NOT EXISTS idx_stream_recordings_created_at ON stream_recordings(created_at DESC);
