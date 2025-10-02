-- Update database schema for new wallet-based streaming implementation V2
-- This script adds the V2 streaming columns to the users table

-- Add V2 streaming columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS livepeer_stream_id_v2 VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS playback_id_v2 VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_key_v2 VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_live_v2 BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_started_at_v2 TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_title_v2 VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_description_v2 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_category_v2 VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_tags_v2 TEXT[];

-- Create stream_sessions_v2 table for V2 streaming sessions
CREATE TABLE IF NOT EXISTS stream_sessions_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    livepeer_stream_id VARCHAR(255) NOT NULL,
    playback_id VARCHAR(255) NOT NULL,
    stream_key VARCHAR(255) NOT NULL,
    
    -- Stream metadata
    title VARCHAR(255),
    description TEXT,
    category VARCHAR(100),
    tags TEXT[],
    
    -- Stream status
    is_live BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT FALSE,
    is_healthy BOOLEAN DEFAULT NULL,
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE,
    
    -- Stream metrics
    viewer_count INTEGER DEFAULT 0,
    peak_viewers INTEGER DEFAULT 0,
    total_viewers INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 0, -- in seconds
    
    -- Technical metrics
    ingest_rate DECIMAL(10,2) DEFAULT 0.00,
    outgoing_rate DECIMAL(10,2) DEFAULT 0.00,
    bitrate INTEGER DEFAULT 0,
    resolution VARCHAR(20),
    fps INTEGER DEFAULT 0,
    
    -- Additional data
    metadata JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_livepeer_stream_id_v2 ON users(livepeer_stream_id_v2);
CREATE INDEX IF NOT EXISTS idx_users_playback_id_v2 ON users(playback_id_v2);
CREATE INDEX IF NOT EXISTS idx_users_is_live_v2 ON users(is_live_v2);
CREATE INDEX IF NOT EXISTS idx_users_stream_started_at_v2 ON users(stream_started_at_v2);

CREATE INDEX IF NOT EXISTS idx_stream_sessions_v2_user_id ON stream_sessions_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_v2_livepeer_stream_id ON stream_sessions_v2(livepeer_stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_v2_playback_id ON stream_sessions_v2(playback_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_v2_is_live ON stream_sessions_v2(is_live);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_v2_started_at ON stream_sessions_v2(started_at);

-- Add comments for documentation
COMMENT ON COLUMN users.livepeer_stream_id_v2 IS 'Livepeer stream ID for V2 streaming';
COMMENT ON COLUMN users.playback_id_v2 IS 'Livepeer playback ID for V2 streaming';
COMMENT ON COLUMN users.stream_key_v2 IS 'Livepeer stream key for V2 streaming';
COMMENT ON COLUMN users.is_live_v2 IS 'Whether the user is currently live with V2 streaming';
COMMENT ON COLUMN users.stream_started_at_v2 IS 'When the V2 stream started';
COMMENT ON COLUMN users.stream_title_v2 IS 'Title of the V2 stream';
COMMENT ON COLUMN users.stream_description_v2 IS 'Description of the V2 stream';
COMMENT ON COLUMN users.stream_category_v2 IS 'Category of the V2 stream';
COMMENT ON COLUMN users.stream_tags_v2 IS 'Tags for the V2 stream';

COMMENT ON TABLE stream_sessions_v2 IS 'V2 streaming sessions for wallet-based streaming';

