-- StreamFi perf-lab schema.
--
-- Derived from db/schema.sql plus the db/migrations/*.sql files that touch the tables
-- exercised by the hot-path audit. Only the tables the audited queries read or write are
-- created. Everything here reproduces the BASELINE index state, i.e. db/schema.sql +
-- db/migrations as written.
--
-- NOT applied: scripts/optimize-database.sql. That script re-uses two index names that
-- db/schema.sql also creates, with different definitions:
--   idx_users_username : schema.sql -> users(username)      optimize -> users(LOWER(username))
--   idx_users_is_live  : schema.sql -> users(is_live)       optimize -> users(is_live) WHERE is_live = true
-- Both use CREATE INDEX IF NOT EXISTS, so whichever file ran first on production won and
-- the other was silently skipped. Production's actual definition of those two names is
-- therefore UNKNOWN from the repo alone; check with
--   SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN ('idx_users_username','idx_users_is_live');
-- The same script is also the only place idx_users_mux_playback_id / idx_users_mux_stream_id
-- / idx_users_wallet_live / idx_stream_sessions_mux_session_id are defined, so they may be
-- missing in production. This lab assumes they are missing.
--
-- Patches relative to db/schema.sql (each marked "PATCH" below):
--   P1 tags: missing comma after "visibility BOOLEAN DEFAULT true" (syntax error).
--   P2 idx_users_livepeer_stream_id: users.livepeer_stream_id does not exist (removed by the
--      Mux migration) -> dropped.
--   P3 idx_users_playback_id: users.playback_id does not exist (column is mux_playback_id)
--      -> dropped.
--   P4 idx_stream_sessions_livepeer_session: stream_sessions.livepeer_session_id does not
--      exist -> dropped.
--   P5 chat_messages.username: app/api/streams/chat/route.ts POST inserts a "username"
--      column that no DDL in the repo creates -> added (VARCHAR(255), nullable).
--   P6 users.privy_id: referenced by app/api/auth/session/route.ts but not created by any
--      file under db/ -> added (TEXT, nullable) so the auth lookup shape can be reproduced.

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ---------------------------------------------------------------- users (db/schema.sql)
CREATE TABLE IF NOT EXISTS users (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    mux_stream_id VARCHAR(255),
    mux_playback_id VARCHAR(255),
    mux_stream_key VARCHAR(255),
    is_live BOOLEAN DEFAULT FALSE,
    current_viewers INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    stream_started_at TIMESTAMP WITH TIME ZONE,
    emailVerified BOOLEAN DEFAULT FALSE,
    emailNotifications BOOLEAN DEFAULT TRUE,
    creator JSONB DEFAULT '{}',
    total_tips_received NUMERIC(20, 7) DEFAULT 0,
    total_tips_count INTEGER DEFAULT 0,
    last_tip_at TIMESTAMP,
    enable_recording BOOLEAN DEFAULT false
);
-- db/schema.sql re-adds followers/following as UUID[]; the TEXT[] originals win under
-- IF NOT EXISTS, so the table ends up with TEXT[] columns.
ALTER TABLE users ADD COLUMN IF NOT EXISTS followers TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS following TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_access_type TEXT DEFAULT 'public'
  CHECK (stream_access_type IN ('public', 'password', 'subscription'));
-- db/migrations/add-stream-privacy-and-subs.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_privacy VARCHAR(20) DEFAULT 'public';
ALTER TABLE users ADD COLUMN IF NOT EXISTS share_token VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS mux_signed_playback_id VARCHAR(255);
-- db/migrations/add-admin-panel.sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_banned  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT;
-- db/migrations/add-latency-mode.sql, add-mux-provisioning-flags.sql, add-routes-f-platform-features.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS latency_mode VARCHAR(10) DEFAULT 'low';
ALTER TABLE users ADD COLUMN IF NOT EXISTS mux_stream_provisioned_with_dvr BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mux_stream_provisioned_with_signed_playback BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
-- PATCH P6
ALTER TABLE users ADD COLUMN IF NOT EXISTS privy_id TEXT;

-- ---------------------------------------------------------------- stream_sessions
CREATE TABLE IF NOT EXISTS stream_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    mux_session_id VARCHAR(255),
    title VARCHAR(255),
    playback_id VARCHAR(255),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN ended_at IS NOT NULL THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
            ELSE NULL
        END
    ) STORED,
    peak_viewers INTEGER DEFAULT 0,
    total_unique_viewers INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    avg_bitrate INTEGER,
    resolution VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------- chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'message',
    is_deleted BOOLEAN DEFAULT FALSE,
    is_moderated BOOLEAN DEFAULT FALSE,
    moderated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- PATCH P5
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS username VARCHAR(255);

-- ---------------------------------------------------------------- stream_viewers
CREATE TABLE IF NOT EXISTS stream_viewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    country VARCHAR(2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------- stream_recordings
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
-- db/migrations/add-needs-review.sql
ALTER TABLE stream_recordings ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;

-- ---------------------------------------------------------------- stream_categories / tags
CREATE TABLE IF NOT EXISTS stream_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    tags TEXT[],
    imageUrl VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(100) UNIQUE NOT NULL,
    visibility BOOLEAN DEFAULT true,  -- PATCH P1: comma was missing here
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------- whitelist / clips
-- db/migrations/add-feature-flags-clips-whitelist-preferences.sql
CREATE TABLE IF NOT EXISTS stream_whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    streamer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    identifier VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (streamer_id, user_id),
    UNIQUE (streamer_id, identifier)
);

CREATE TABLE IF NOT EXISTS stream_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE SET NULL,
    clipped_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    streamer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    playback_id VARCHAR(255),
    mux_asset_id VARCHAR(255),
    start_offset INTEGER NOT NULL,
    duration INTEGER NOT NULL CHECK (duration BETWEEN 1 AND 60),
    status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------- reports (add-admin-panel.sql)
CREATE TABLE IF NOT EXISTS stream_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id TEXT        NOT NULL,
  stream_id   TEXT        NOT NULL,
  streamer    TEXT        NOT NULL,
  reason      TEXT        NOT NULL,
  details     TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bug_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id TEXT        NOT NULL,
  category    TEXT        NOT NULL,
  description TEXT        NOT NULL,
  severity    TEXT        NOT NULL DEFAULT 'medium',
  status      TEXT        NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- notifications (NEW in this PR)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, title TEXT NOT NULL, body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_notifications_user_keyset ON notifications (user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id) WHERE is_read = false;

-- ---------------------------------------------------------------- baseline indexes
-- db/schema.sql
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
-- PATCH P2: CREATE INDEX IF NOT EXISTS idx_users_livepeer_stream_id ON users(livepeer_stream_id);
-- PATCH P3: CREATE INDEX IF NOT EXISTS idx_users_playback_id ON users(playback_id);
CREATE INDEX IF NOT EXISTS idx_users_is_live ON users(is_live);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_user_id ON stream_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_started_at ON stream_sessions(started_at);
-- PATCH P4: CREATE INDEX IF NOT EXISTS idx_stream_sessions_livepeer_session ON stream_sessions(livepeer_session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_stream_session ON chat_messages(stream_session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_not_deleted ON chat_messages(stream_session_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_stream_viewers_session ON stream_viewers(stream_session_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_user_id ON stream_viewers(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_session_id ON stream_viewers(session_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_joined_at ON stream_viewers(joined_at);
CREATE INDEX IF NOT EXISTS idx_stream_categories_title ON stream_categories(title);
CREATE INDEX IF NOT EXISTS idx_stream_categories_active ON stream_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_tags_title ON tags(title);
CREATE INDEX IF NOT EXISTS idx_tags_title_lower ON tags(LOWER(title));
CREATE INDEX IF NOT EXISTS idx_stream_recordings_user_id ON stream_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_recordings_playback_id ON stream_recordings(playback_id);
CREATE INDEX IF NOT EXISTS idx_stream_recordings_created_at ON stream_recordings(created_at DESC);
-- db/migrations/add-stream-privacy-and-subs.sql
CREATE INDEX IF NOT EXISTS idx_users_stream_privacy ON users(stream_privacy);
CREATE INDEX IF NOT EXISTS idx_users_share_token ON users(share_token);
-- db/migrations/add-feature-flags-clips-whitelist-preferences.sql
CREATE INDEX IF NOT EXISTS idx_stream_whitelist_streamer ON stream_whitelist(streamer_id);
CREATE INDEX IF NOT EXISTS idx_stream_whitelist_user ON stream_whitelist(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_clips_streamer ON stream_clips(streamer_id);
CREATE INDEX IF NOT EXISTS idx_stream_clips_clipped_by ON stream_clips(clipped_by);
CREATE INDEX IF NOT EXISTS idx_stream_clips_status ON stream_clips(status);
CREATE INDEX IF NOT EXISTS idx_stream_clips_session ON stream_clips(stream_session_id);
-- db/migrations/add-admin-panel.sql
CREATE INDEX IF NOT EXISTS stream_reports_status_idx ON stream_reports (status);
CREATE INDEX IF NOT EXISTS stream_reports_created_at_idx ON stream_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS bug_reports_status_idx    ON bug_reports (status);
CREATE INDEX IF NOT EXISTS bug_reports_severity_idx  ON bug_reports (severity);
CREATE INDEX IF NOT EXISTS bug_reports_created_at_idx ON bug_reports (created_at DESC);

-- db/schema.sql seed rows
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
