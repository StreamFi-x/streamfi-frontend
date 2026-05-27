-- ─── Feature Flags ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,          -- e.g. 'clips', 'gifts', 'subscriptions'
    description TEXT,
    enabled BOOLEAN DEFAULT FALSE,             -- global on/off
    rollout_percentage INTEGER DEFAULT 0       -- 0-100; used when enabled=true
        CHECK (rollout_percentage BETWEEN 0 AND 100),
    allowed_user_ids UUID[] DEFAULT '{}',      -- explicit per-user overrides
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── Stream Whitelist ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stream_whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    streamer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Either user_id (registered user) or raw identifier (username/wallet) for pending invites
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    identifier VARCHAR(255),                   -- username or wallet address
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (streamer_id, user_id),
    UNIQUE (streamer_id, identifier)
);

-- ─── Stream Clips ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stream_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE SET NULL,
    clipped_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    streamer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    playback_id VARCHAR(255),                  -- Mux clip playback id
    mux_asset_id VARCHAR(255),                 -- Mux asset id for the clip
    start_offset INTEGER NOT NULL,             -- seconds from stream start
    duration INTEGER NOT NULL                  -- 30-60 seconds
        CHECK (duration BETWEEN 1 AND 60),
    status VARCHAR(20) DEFAULT 'processing'    -- processing | ready | failed
        CHECK (status IN ('processing', 'ready', 'failed')),
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── User Preferences ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    -- Playback
    stream_quality VARCHAR(20) DEFAULT 'auto'  -- auto | 1080p | 720p | 480p | 360p
        CHECK (stream_quality IN ('auto', '1080p', '720p', '480p', '360p')),
    -- Notifications
    notify_live BOOLEAN DEFAULT TRUE,
    notify_clips BOOLEAN DEFAULT TRUE,
    notify_tips BOOLEAN DEFAULT TRUE,
    -- UI
    theme VARCHAR(20) DEFAULT 'dark'
        CHECK (theme IN ('dark', 'light', 'system')),
    language VARCHAR(10) DEFAULT 'en',
    -- Chat
    chat_font_size VARCHAR(10) DEFAULT 'medium'
        CHECK (chat_font_size IN ('small', 'medium', 'large')),
    show_timestamps BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_stream_whitelist_streamer ON stream_whitelist(streamer_id);
CREATE INDEX IF NOT EXISTS idx_stream_whitelist_user ON stream_whitelist(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_clips_streamer ON stream_clips(streamer_id);
CREATE INDEX IF NOT EXISTS idx_stream_clips_clipped_by ON stream_clips(clipped_by);
CREATE INDEX IF NOT EXISTS idx_stream_clips_status ON stream_clips(status);
CREATE INDEX IF NOT EXISTS idx_stream_clips_session ON stream_clips(stream_session_id);

-- ─── Seed default feature flags ───────────────────────────────────────────────
INSERT INTO feature_flags (key, description, enabled, rollout_percentage) VALUES
  ('clips',              'Allow viewers to create short clips from live streams', TRUE,  100),
  ('gifts',              'Virtual gift sending during streams',                   FALSE, 0),
  ('subscriptions',      'Paid channel subscriptions',                            FALSE, 0),
  ('token_gated_streams','Token-gated stream access',                             FALSE, 0),
  ('private_streams',    'Whitelist-based private stream access',                 TRUE,  100)
ON CONFLICT (key) DO NOTHING;
