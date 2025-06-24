-- ============================================================================
-- StreamFi Complete Database Schema
-- Includes existing tables + new streaming functionality
-- ============================================================================

-- Drop existing tables if you want to recreate from scratch (CAREFUL!)
-- DROP TABLE IF EXISTS chat_messages CASCADE;
-- DROP TABLE IF EXISTS stream_viewers CASCADE;
-- DROP TABLE IF EXISTS stream_sessions CASCADE;
-- DROP TABLE IF EXISTS verification_tokens CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS waitlist CASCADE;

-- ============================================================================
-- EXISTING TABLES (Your Current Schema)
-- ============================================================================

-- 1. Waitlist Table (Your existing table)
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table (Your existing + streaming columns)
CREATE TABLE IF NOT EXISTS users (
    -- Your existing columns
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    streamkey VARCHAR(255),
    avatar VARCHAR(255),
    bio TEXT,
    socialLinks JSONB,
    notifications JSONB[],
    categories TEXT[],
    followers TEXT[],
    following TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- New streaming columns
    livepeer_stream_id VARCHAR(255),
    playback_id VARCHAR(255),
    is_live BOOLEAN DEFAULT FALSE,
    current_viewers INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    stream_started_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional columns for complete functionality
    emailVerified BOOLEAN DEFAULT FALSE,
    emailNotifications BOOLEAN DEFAULT TRUE,
    creator JSONB DEFAULT '{}'
);

-- ============================================================================
-- NEW STREAMING TABLES
-- ============================================================================

-- 3. Stream Sessions Table (Analytics and History)
CREATE TABLE IF NOT EXISTS stream_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    livepeer_session_id VARCHAR(255),
    
    -- Session tracking
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN ended_at IS NOT NULL THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
            ELSE NULL 
        END
    ) STORED,
    
    -- Stream metrics
    peak_viewers INTEGER DEFAULT 0,
    total_unique_viewers INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    
    -- Technical data
    avg_bitrate INTEGER,
    resolution VARCHAR(20),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Chat Messages Table (Live Chat)
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
    
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'message',    -- 'message', 'emote', 'system'
    
    -- Moderation
    is_deleted BOOLEAN DEFAULT FALSE,
    is_moderated BOOLEAN DEFAULT FALSE,
    moderated_by UUID REFERENCES users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Stream Viewers Table (Real-time Viewer Tracking)
CREATE TABLE IF NOT EXISTS stream_viewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- nullable for anonymous viewers
    
    session_id VARCHAR(255) NOT NULL,               -- Socket/browser session ID
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    
    -- Geographic data (optional)
    ip_address INET,
    country VARCHAR(2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Verification Tokens Table (Email Verification)
CREATE TABLE IF NOT EXISTS verification_tokens (
    email VARCHAR(255),
    token VARCHAR(6),                              -- 6-digit verification code
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour')
);

-- 7. Categories Table (Stream Categories)
CREATE TABLE IF NOT EXISTS stream_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) UNIQUE NOT NULL,            -- "Gaming", "Tech", "Education", etc.
    description TEXT,
    tags TEXT[],                                   -- Related tags array
    imageUrl VARCHAR(255),                         -- Category thumbnail
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet);
CREATE INDEX IF NOT EXISTS idx_users_wallet_lower ON users(LOWER(wallet));
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_livepeer_stream_id ON users(livepeer_stream_id);
CREATE INDEX IF NOT EXISTS idx_users_playback_id ON users(playback_id);
CREATE INDEX IF NOT EXISTS idx_users_is_live ON users(is_live);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Stream sessions indexes
CREATE INDEX IF NOT EXISTS idx_stream_sessions_user_id ON stream_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_started_at ON stream_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_livepeer_session ON stream_sessions(livepeer_session_id);

-- Chat messages indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_stream_session ON chat_messages(stream_session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_not_deleted ON chat_messages(stream_session_id) WHERE is_deleted = FALSE;

-- Stream viewers indexes
CREATE INDEX IF NOT EXISTS idx_stream_viewers_session ON stream_viewers(stream_session_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_user_id ON stream_viewers(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_session_id ON stream_viewers(session_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_joined_at ON stream_viewers(joined_at);

-- Verification tokens indexes
CREATE INDEX IF NOT EXISTS idx_verification_tokens_email ON verification_tokens(email);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires ON verification_tokens(expires_at);

-- Waitlist indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_subscribed_at ON waitlist(subscribed_at);

-- Stream categories indexes
CREATE INDEX IF NOT EXISTS idx_stream_categories_title ON stream_categories(title);
CREATE INDEX IF NOT EXISTS idx_stream_categories_active ON stream_categories(is_active);

-- ============================================================================
-- INSERT DEFAULT DATA
-- ============================================================================

-- Insert default stream categories
INSERT INTO stream_categories (title, description, tags) VALUES
('Gaming', 'Video game streaming and gameplay', ARRAY['gaming', 'esports', 'gameplay']),
('Technology', 'Tech talks, coding, and development', ARRAY['coding', 'programming', 'tech']),
('Education', 'Educational content and tutorials', ARRAY['learning', 'tutorial', 'education']),
('Entertainment', 'General entertainment content', ARRAY['entertainment', 'variety', 'fun']),
('Music', 'Live music and audio content', ARRAY['music', 'audio', 'performance']),
('Art & Design', 'Creative content and design work', ARRAY['art', 'design', 'creative']),
('Business', 'Business discussions and entrepreneurship', ARRAY['business', 'startup', 'entrepreneur']),
('Lifestyle', 'Lifestyle and personal content', ARRAY['lifestyle', 'personal', 'vlog'])
ON CONFLICT (title) DO NOTHING;

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to clean up expired verification tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM verification_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get stream analytics for a user
CREATE OR REPLACE FUNCTION get_user_stream_analytics(user_wallet VARCHAR(255))
RETURNS TABLE (
    total_sessions BIGINT,
    total_stream_time BIGINT,
    avg_session_duration NUMERIC,
    max_peak_viewers INTEGER,
    total_unique_viewers BIGINT,
    total_messages BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(ss.id) as total_sessions,
        COALESCE(SUM(ss.duration_seconds), 0) as total_stream_time,
        COALESCE(AVG(ss.duration_seconds), 0) as avg_session_duration,
        COALESCE(MAX(ss.peak_viewers), 0) as max_peak_viewers,
        COALESCE(SUM(ss.total_unique_viewers), 0) as total_unique_viewers,
        COALESCE(SUM(ss.total_messages), 0) as total_messages
    FROM users u
    LEFT JOIN stream_sessions ss ON u.id = ss.user_id
    WHERE LOWER(u.wallet) = LOWER(user_wallet);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if all tables exist
SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            'users', 'waitlist', 'stream_sessions', 'chat_messages', 
            'stream_viewers', 'verification_tokens', 'stream_categories'
        ) THEN '✅ Created'
        ELSE '❌ Missing'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'users', 'waitlist', 'stream_sessions', 'chat_messages', 
    'stream_viewers', 'verification_tokens', 'stream_categories'
)
ORDER BY table_name;

-- Check streaming columns in users table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN (
    'livepeer_stream_id', 'playback_id', 'is_live', 
    'current_viewers', 'total_views', 'stream_started_at',
    'emailVerified', 'emailNotifications', 'creator'
)
ORDER BY column_name;

-- Count records in each table
SELECT 
    'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 
    'waitlist' as table_name, COUNT(*) as record_count FROM waitlist
UNION ALL
SELECT 
    'stream_sessions' as table_name, COUNT(*) as record_count FROM stream_sessions
UNION ALL
SELECT 
    'chat_messages' as table_name, COUNT(*) as record_count FROM chat_messages
UNION ALL
SELECT 
    'stream_viewers' as table_name, COUNT(*) as record_count FROM stream_viewers
UNION ALL
SELECT 
    'verification_tokens' as table_name, COUNT(*) as record_count FROM verification_tokens
UNION ALL
SELECT 
    'stream_categories' as table_name, COUNT(*) as record_count FROM stream_categories;

-- ============================================================================
-- SCHEMA COMPLETE!
-- Ready for StreamFi with full streaming functionality
-- ============================================================================