-- ============================================================================
-- StreamFi Canonical PostgreSQL Database Schema
--
-- Authoritative source of truth for bootstrapping fresh environments.
-- Reconciled with all production migrations and application dependencies (#1867).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Waitlist ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    streamkey VARCHAR(255),
    avatar VARCHAR(255),
    banner VARCHAR(255),
    bio TEXT,
    socialLinks JSONB,
    notifications JSONB[],
    categories TEXT[],
    followers TEXT[],
    following TEXT[],
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
    enable_recording BOOLEAN DEFAULT false,
    latency_mode VARCHAR(10) DEFAULT 'low',
    stream_privacy VARCHAR(20) DEFAULT 'public',
    share_token VARCHAR(64),
    mux_signed_playback_id VARCHAR(255),
    mux_stream_provisioned_with_dvr BOOLEAN DEFAULT FALSE,
    mux_stream_provisioned_with_signed_playback BOOLEAN DEFAULT FALSE,
    is_banned BOOLEAN NOT NULL DEFAULT false,
    banned_at TIMESTAMPTZ,
    ban_reason TEXT,
    role TEXT DEFAULT 'user',
    suspended_until TIMESTAMPTZ,
    privy_id TEXT UNIQUE,
    pending_email VARCHAR(255),
    pending_email_requested_at TIMESTAMPTZ,
    email_change_status VARCHAR(32) NOT NULL DEFAULT 'none',
    email_change_failure_reason TEXT,
    previous_verified_email VARCHAR(255)
);

-- Idempotent column additions for existing databases
ALTER TABLE users ADD COLUMN IF NOT EXISTS followers UUID[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS following UUID[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_access_type TEXT DEFAULT 'public'
    CHECK (stream_access_type IN ('public', 'password', 'subscription'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS latency_mode VARCHAR(10) DEFAULT 'low';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_privacy VARCHAR(20) DEFAULT 'public';
ALTER TABLE users ADD COLUMN IF NOT EXISTS share_token VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS mux_signed_playback_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS mux_stream_provisioned_with_dvr BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mux_stream_provisioned_with_signed_playback BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banner VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS privy_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email_requested_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_status VARCHAR(32) NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_failure_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS previous_verified_email VARCHAR(255);

-- ─── Username History ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS username_history (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    previous_username VARCHAR(255) NOT NULL,
    new_username      VARCHAR(255) NOT NULL,
    changed_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    redirect_until    TIMESTAMPTZ  NOT NULL DEFAULT (now() + INTERVAL '90 days'),
    hold_until        TIMESTAMPTZ  NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_username_history_previous_lower
    ON username_history (LOWER(previous_username), changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_username_history_user_changed
    ON username_history (user_id, changed_at DESC);

-- ─── Subscription Tiers ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price_usdc NUMERIC(10,2) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Subscriptions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier_id UUID REFERENCES subscription_tiers(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    payment_tx_hash VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Stream Sessions ─────────────────────────────────────────────────────────
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
    
    -- Per-stream latency configuration
    -- 'low' = low-latency (3-5s delay, no DVR/rewind)
    -- 'standard' = standard latency (10-15s delay, DVR/rewind enabled)
    -- NULL falls back to user's global preference
    latency_mode VARCHAR(10),
    end_source VARCHAR(32),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE stream_sessions ADD COLUMN IF NOT EXISTS latency_mode VARCHAR(10);
ALTER TABLE stream_sessions ADD COLUMN IF NOT EXISTS end_source VARCHAR(32);

-- ─── Chat Messages ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
    username VARCHAR(255),
    
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'message',  
    
    is_deleted BOOLEAN DEFAULT FALSE,
    is_moderated BOOLEAN DEFAULT FALSE,
    moderated_by UUID REFERENCES users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS username VARCHAR(255);

-- ─── Watch History ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watch_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viewer_id       UUID REFERENCES users(id) ON DELETE CASCADE,
    streamer_id     UUID REFERENCES users(id),
    stream_type     TEXT NOT NULL,   -- 'live' | 'vod' | 'clip'
    stream_id       TEXT,            -- recording ID if VOD/clip, null if live
    stream_title    TEXT,            -- title of the stream at the time
    started_at      TIMESTAMPTZ DEFAULT now(),
    last_seen_at    TIMESTAMPTZ DEFAULT now(),
    watch_seconds   INT DEFAULT 0,
    completed       BOOLEAN DEFAULT false,
    UNIQUE(viewer_id, streamer_id, stream_id, stream_type)
);

-- ─── Stream Viewers ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stream_viewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, 
    
    session_id VARCHAR(255) NOT NULL,         
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    heartbeat_at TIMESTAMPTZ,
    left_reason VARCHAR(32),
    ip_address INET,
    country VARCHAR(2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE stream_viewers ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;
ALTER TABLE stream_viewers ADD COLUMN IF NOT EXISTS left_reason VARCHAR(32);

-- ─── Stream Recordings ───────────────────────────────────────────────────────
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
    needs_review BOOLEAN DEFAULT FALSE,
    unavailable_at TIMESTAMPTZ,
    UNIQUE(mux_asset_id)
);

ALTER TABLE stream_recordings ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;
ALTER TABLE stream_recordings ADD COLUMN IF NOT EXISTS unavailable_at TIMESTAMPTZ;

-- ─── Transcription Jobs (#1867) ──────────────────────────────────────────────
-- Backing table for VOD auto-generated captions and WebVTT tracks.
CREATE TABLE IF NOT EXISTS transcription_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id UUID NOT NULL REFERENCES stream_recordings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    content TEXT,                        -- WebVTT text once ready
    error_reason TEXT,                   -- populated on failure
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(recording_id)                 -- one active job per recording
);

CREATE INDEX IF NOT EXISTS idx_transcription_jobs_recording_id
    ON transcription_jobs(recording_id);
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_user_id
    ON transcription_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_status
    ON transcription_jobs(status);

-- ─── Admin Reports & Abuse Resistance ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stream_reports (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id TEXT        NOT NULL,
    stream_id   TEXT        NOT NULL,
    streamer    TEXT        NOT NULL,
    reason      TEXT        NOT NULL,
    details     TEXT,
    status      TEXT        NOT NULL DEFAULT 'pending',  -- pending | reviewed | dismissed
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stream_reports_status_idx ON stream_reports (status);
CREATE INDEX IF NOT EXISTS stream_reports_created_at_idx ON stream_reports (created_at DESC);

CREATE TABLE IF NOT EXISTS bug_reports (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id TEXT        NOT NULL,
    category    TEXT        NOT NULL,
    description TEXT        NOT NULL,
    severity    TEXT        NOT NULL DEFAULT 'medium',  -- low | medium | high | critical
    status      TEXT        NOT NULL DEFAULT 'pending', -- pending | reviewed | resolved
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bug_reports_status_idx    ON bug_reports (status);
CREATE INDEX IF NOT EXISTS bug_reports_severity_idx  ON bug_reports (severity);
CREATE INDEX IF NOT EXISTS bug_reports_created_at_idx ON bug_reports (created_at DESC);

-- ─── Creator Finance, Tips & Payouts ─────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE payout_method AS ENUM ('bank_transfer', 'stellar_wallet', 'mobile_money');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, followee_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_followee_id ON user_follows(followee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON user_follows(follower_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tip_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    amount_xlm NUMERIC(20,7) NOT NULL,
    price_usd NUMERIC(20,7),
    tx_hash TEXT,
    memo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tip_transactions_creator_id ON tip_transactions(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tip_transactions_supporter_id ON tip_transactions(supporter_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tip_transactions_tx_hash_unique
    ON tip_transactions(tx_hash)
    WHERE tx_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS gift_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    gift_type TEXT,
    amount_usdc NUMERIC(10,2) NOT NULL,
    tx_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_transactions_creator_id ON gift_transactions(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_supporter_id ON gift_transactions(supporter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payouts (
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

CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id, initiated_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status, initiated_at DESC);

-- ─── Stream Schedule & Reminders ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stream_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_mins INT NOT NULL DEFAULT 120,
    status TEXT NOT NULL DEFAULT 'upcoming',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_schedule_creator_id ON stream_schedule(creator_id, scheduled_at ASC);
CREATE INDEX IF NOT EXISTS idx_stream_schedule_status ON stream_schedule(status, scheduled_at ASC);

CREATE TABLE IF NOT EXISTS stream_reminders (
    schedule_id UUID NOT NULL REFERENCES stream_schedule(id) ON DELETE CASCADE,
    viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    remind_at TIMESTAMPTZ NOT NULL,
    sent BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (schedule_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_stream_reminders_due ON stream_reminders(sent, remind_at);

-- ─── Badges ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badge_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    tier TEXT NOT NULL,
    sort_order INT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_badges (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id TEXT NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id, earned_at DESC);

-- ─── Whitelist & Clips ───────────────────────────────────────────────────────
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
    status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed', 'unavailable')),
    view_count INTEGER DEFAULT 0,
    unavailable_at TIMESTAMPTZ,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stream_whitelist_streamer ON stream_whitelist(streamer_id);
CREATE INDEX IF NOT EXISTS idx_stream_whitelist_user ON stream_whitelist(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_clips_streamer ON stream_clips(streamer_id);
CREATE INDEX IF NOT EXISTS idx_stream_clips_clipped_by ON stream_clips(clipped_by);
CREATE INDEX IF NOT EXISTS idx_stream_clips_status ON stream_clips(status);
CREATE INDEX IF NOT EXISTS idx_stream_clips_session ON stream_clips(stream_session_id);

-- ─── Feature Flags & Preferences ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT FALSE,
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
    allowed_user_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    stream_quality VARCHAR(20) DEFAULT 'auto' CHECK (stream_quality IN ('auto', '1080p', '720p', '480p', '360p')),
    notify_live BOOLEAN DEFAULT TRUE,
    notify_clips BOOLEAN DEFAULT TRUE,
    notify_tips BOOLEAN DEFAULT TRUE,
    theme VARCHAR(20) DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'system')),
    language VARCHAR(10) DEFAULT 'en',
    chat_font_size VARCHAR(10) DEFAULT 'medium' CHECK (chat_font_size IN ('small', 'medium', 'large')),
    show_timestamps BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── Sessions & Authentication ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sessions (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT        NOT NULL UNIQUE,
    ip_address   INET,
    user_agent   TEXT,
    device_hint  TEXT,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked      BOOLEAN     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS user_sessions_user
    ON user_sessions(user_id, revoked, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_token_hash
    ON user_sessions(token_hash);

CREATE TABLE IF NOT EXISTS user_two_factor (
    user_id                 UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    totp_secret_ciphertext  TEXT,
    totp_secret_iv          TEXT,
    totp_secret_tag         TEXT,
    totp_enabled            BOOLEAN     NOT NULL DEFAULT false,
    backup_code_hashes      TEXT,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT        NOT NULL UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    consumed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user
    ON password_reset_tokens(user_id, consumed_at, expires_at);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email        VARCHAR(255) NOT NULL,
    token_hash   TEXT        NOT NULL UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    consumed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS email_verification_tokens_user
    ON email_verification_tokens(user_id, consumed_at, expires_at);

CREATE TABLE IF NOT EXISTS magic_link_tokens (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT        NOT NULL UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    consumed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS magic_link_tokens_user
    ON magic_link_tokens(user_id, consumed_at, expires_at);

-- ─── Notifications ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_keyset ON notifications (user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id) WHERE is_read = false;

-- ─── Concurrent Viewer Cache & Experiments ───────────────────────────────────
CREATE TABLE IF NOT EXISTS concurrent_viewer_cache (
    id VARCHAR(255) PRIMARY KEY,
    total_concurrent INTEGER NOT NULL DEFAULT 0,
    breakdown_json TEXT NOT NULL DEFAULT '[]',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_concurrent_viewer_cache_updated ON concurrent_viewer_cache(last_updated);

CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'planning',
    variants TEXT NOT NULL,
    variant_weights TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    concluded_at TIMESTAMP WITH TIME ZONE,
    excluded_user_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_experiments_key ON experiments(key);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);

CREATE TABLE IF NOT EXISTS user_experiment_assignments (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    variant VARCHAR(50) NOT NULL,
    stable_hash VARCHAR(64) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, experiment_id)
);

CREATE INDEX IF NOT EXISTS idx_user_experiment_assignments_experiment ON user_experiment_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_user_experiment_assignments_variant ON user_experiment_assignments(variant);

CREATE TABLE IF NOT EXISTS experiment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_experiment_events_user ON experiment_events(user_id);
CREATE INDEX IF NOT EXISTS idx_experiment_events_experiment ON experiment_events(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_events_event_type ON experiment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_experiment_events_recorded_at ON experiment_events(recorded_at);
CREATE INDEX IF NOT EXISTS idx_experiment_events_exp_event_type ON experiment_events(experiment_id, event_type);

-- ─── Retention Analytics ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS route_f_session_retention (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bucket_minute INT NOT NULL,
    concurrent_viewers INT NOT NULL DEFAULT 0,
    joined_count INT NOT NULL DEFAULT 0,
    left_count INT NOT NULL DEFAULT 0,
    retention_rate NUMERIC(5,4),
    avg_watch_time_seconds INT NOT NULL DEFAULT 0,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id, bucket_minute)
);

CREATE INDEX IF NOT EXISTS idx_rf_retention_session ON route_f_session_retention(session_id, bucket_minute);
CREATE INDEX IF NOT EXISTS idx_rf_retention_creator ON route_f_session_retention(creator_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS route_f_backfill_status (
    feature_name TEXT PRIMARY KEY,
    is_running BOOLEAN NOT NULL DEFAULT false,
    last_cursor TEXT,
    records_processed BIGINT NOT NULL DEFAULT 0,
    last_run_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT
);

-- ─── Extensions, Raids & Squads ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS extension_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    json_schema JSONB NOT NULL,
    icon_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stream_extensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    extension_id UUID REFERENCES extension_catalog(id) ON DELETE CASCADE,
    position VARCHAR(20) CHECK (position IN ('overlay', 'panel')),
    config JSONB DEFAULT '{}',
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_overlay_config (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(50) DEFAULT 'default',
    position VARCHAR(50) DEFAULT 'bottom-right',
    font_size INTEGER DEFAULT 16,
    opacity NUMERIC(3, 2) DEFAULT 1.0,
    token TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS co_stream_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    invitee_id UUID REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS squad_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user_id REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(creator_id, user_id)
);

CREATE TABLE IF NOT EXISTS raids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raider_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_id REFERENCES users(id) ON DELETE CASCADE,
    viewer_count INTEGER NOT NULL,
    raided_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_acknowledged BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_stream_extensions_user ON stream_extensions(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_extensions_enabled ON stream_extensions(is_enabled);
CREATE INDEX IF NOT EXISTS idx_co_stream_invites_creator ON co_stream_invites(creator_id);
CREATE INDEX IF NOT EXISTS idx_co_stream_invites_invitee ON co_stream_invites(invitee_id);
CREATE INDEX IF NOT EXISTS idx_co_stream_invites_status ON co_stream_invites(status);
CREATE INDEX IF NOT EXISTS idx_raids_target ON raids(target_id);
CREATE INDEX IF NOT EXISTS idx_raids_raider ON raids(raider_id);
CREATE INDEX IF NOT EXISTS idx_raids_acknowledged ON raids(is_acknowledged);

-- ─── Emotes & Moderation Queue ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_emotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    image_url TEXT NOT NULL,
    width INT DEFAULT 28,
    height INT DEFAULT 28,
    subscriber_only BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_emotes_creator_code_ci
    ON channel_emotes (creator_id, LOWER(code));

CREATE TABLE IF NOT EXISTS global_emotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moderation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type TEXT NOT NULL CHECK (item_type IN ('stream', 'chat_message', 'profile', 'clip', 'emote')),
    item_id TEXT NOT NULL,
    reporter_id UUID REFERENCES users(id),
    reported_user_id UUID REFERENCES users(id),
    reason TEXT NOT NULL,
    details TEXT,
    auto_flagged BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'actioned', 'dismissed')),
    report_count INT DEFAULT 1,
    priority_score INT DEFAULT 1,
    assigned_to UUID REFERENCES users(id),
    action_taken TEXT CHECK (action_taken IN ('warn', 'remove_content', 'suspend_user', 'ban_user', 'dismiss')),
    action_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    actioned_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS mod_queue_status ON moderation_queue(status, created_at DESC);
CREATE INDEX IF NOT EXISTS mod_queue_priority ON moderation_queue(priority_score DESC, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS mod_queue_item_pending_unique
    ON moderation_queue(item_type, item_id)
    WHERE status IN ('pending', 'under_review');

CREATE TABLE IF NOT EXISTS moderation_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moderation_item_id UUID NOT NULL REFERENCES moderation_queue(id) ON DELETE CASCADE,
    moderator_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Legacy Livepeer Reference Archive ───────────────────────────────────────
-- Archive of identifiers from the retired Livepeer integration (#1408).
CREATE TABLE IF NOT EXISTS legacy_livepeer_refs (
    id BIGSERIAL PRIMARY KEY,
    source_table TEXT NOT NULL,
    source_id UUID NOT NULL,
    column_name TEXT NOT NULL,
    legacy_value TEXT NOT NULL,
    mux_reference TEXT,
    disposition TEXT NOT NULL
        CHECK (disposition IN ('migrated', 'unprovisioned', 'legacy_history')),
    archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source_table, source_id, column_name)
);

-- ─── Verification Tokens & Reference Tables ─────────────────────────────────
CREATE TABLE IF NOT EXISTS verification_tokens (
    email VARCHAR(255),
    token VARCHAR(6),                            
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour')
);

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
    visibility BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stream_tags (
    stream_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    applied_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (stream_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_stream_tags_tag_id ON stream_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_stream_tags_stream_id ON stream_tags(stream_id);

CREATE TABLE IF NOT EXISTS tag_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (suggested_by, name)
);

-- ─── Exchange Rate Quotes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exchange_rate_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quoted_rate NUMERIC(20, 10) NOT NULL,
    quoted_xlm_amount NUMERIC(20, 7) NOT NULL,
    fiat_amount_cents INTEGER NOT NULL,
    quote_token TEXT UNIQUE NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'consumed', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Core Indexes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_live ON users(is_live);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_stream_privacy ON users(stream_privacy);
CREATE INDEX IF NOT EXISTS idx_users_share_token ON users(share_token);
CREATE INDEX IF NOT EXISTS idx_users_pending_email_lower ON users (LOWER(pending_email)) WHERE pending_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_mux_playback_id ON users(mux_playback_id);
CREATE INDEX IF NOT EXISTS idx_users_mux_stream_id ON users(mux_stream_id);

CREATE INDEX IF NOT EXISTS idx_stream_sessions_user_id ON stream_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_started_at ON stream_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_latency_mode ON stream_sessions(latency_mode);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_mux_session_id ON stream_sessions(mux_session_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_open_by_user ON stream_sessions(user_id, started_at DESC) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stream_sessions_open_started_at ON stream_sessions (started_at) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_stream_session ON chat_messages(stream_session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_not_deleted ON chat_messages(stream_session_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_window ON chat_messages(stream_session_id, created_at DESC) WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber_id, creator_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subscriptions_creator ON subscriptions(creator_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires ON subscriptions(expires_at) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_stream_viewers_session ON stream_viewers(stream_session_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_user_id ON stream_viewers(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_session_id ON stream_viewers(session_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_joined_at ON stream_viewers(joined_at);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_email ON verification_tokens(email);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires ON verification_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_subscribed_at ON waitlist(subscribed_at);

CREATE INDEX IF NOT EXISTS idx_stream_categories_title ON stream_categories(title);
CREATE INDEX IF NOT EXISTS idx_stream_categories_title_lower ON stream_categories(LOWER(title));
CREATE INDEX IF NOT EXISTS idx_stream_categories_active ON stream_categories(is_active);

CREATE INDEX IF NOT EXISTS idx_tags_title ON tags(title);
CREATE INDEX IF NOT EXISTS idx_tags_title_lower ON tags(LOWER(title));

CREATE INDEX IF NOT EXISTS idx_watch_history_viewer ON watch_history(viewer_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_watch_history_streamer ON watch_history(streamer_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_stream_recordings_user_id ON stream_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_recordings_playback_id ON stream_recordings(playback_id);
CREATE INDEX IF NOT EXISTS idx_stream_recordings_created_at ON stream_recordings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_quotes_creator_id ON exchange_rate_quotes(creator_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rate_quotes_quote_token ON exchange_rate_quotes(quote_token) WHERE status = 'issued';
CREATE INDEX IF NOT EXISTS idx_exchange_rate_quotes_expires_at ON exchange_rate_quotes(expires_at) WHERE status = 'issued';

-- ─── Seed Data ───────────────────────────────────────────────────────────────
INSERT INTO stream_categories (title, description, tags) VALUES
('Gaming', 'Video game streaming and gameplay', ARRAY['gaming', 'esports', 'gameplay']),
('Technology', 'Tech talks, coding, and development', ARRAY['coding', 'programming', 'tech']),
('Education', 'Educational content and tutorials', ARRAY['learning', 'tutorial', 'education']),
('Entertainment', 'General entertainment content', ARRAY['entertainment', 'variety', 'fun']),
('Music', 'Live music and audio content', ARRAY['music', 'audio', 'performance']),
('Art & Design', 'Creative content and design work', ARRAY['art', 'design', 'creative']),
('Business', 'Business discussions and entrepreneurship', ARRAY['business', 'startup', 'entrepreneur']),
('Lifestyle', 'Lifestyle and personal content', ARRAY['lifestyle', 'personal', 'vlog'])
ON CONFLICT (title) DO UPDATE SET
  description = EXCLUDED.description,
  tags = EXCLUDED.tags
WHERE stream_categories.description IS DISTINCT FROM EXCLUDED.description
   OR stream_categories.tags IS DISTINCT FROM EXCLUDED.tags;

INSERT INTO badge_definitions (id, name, description, icon, tier, sort_order)
VALUES
  ('first_stream', 'First Broadcast', 'Completed first live stream', 'broadcast', 'bronze', 1),
  ('first_tip', 'First Tip', 'Received first XLM tip', 'tip', 'bronze', 2),
  ('first_gift', 'Gift Received', 'Received first Dragon or Lion gift', 'gift', 'silver', 3),
  ('hundred_followers', 'Rising Star', 'Reached 100 followers', 'followers', 'silver', 4),
  ('thousand_followers', 'Community Builder', 'Reached 1,000 followers', 'community', 'gold', 5),
  ('ten_hours_streamed', 'Marathon Streamer', 'Streamed for 10 hours total', 'clock-10', 'silver', 6),
  ('hundred_hours_streamed', 'Veteran Broadcaster', 'Streamed for 100 hours total', 'clock-100', 'gold', 7),
  ('top_earner', 'Top Earner', 'Earned 1,000 USDC total', 'diamond', 'diamond', 8)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    tier = EXCLUDED.tier,
    sort_order = EXCLUDED.sort_order;

-- ─── Helper Functions ────────────────────────────────────────────────────────
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
    WHERE u.wallet = user_wallet;
END;
$$ LANGUAGE plpgsql;

-- ─── Schema Bootstrap Verification Check ─────────────────────────────────────
SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            'users', 'waitlist', 'stream_sessions', 'chat_messages', 
            'stream_viewers', 'verification_tokens', 'stream_categories',
            'watch_history', 'stream_recordings', 'transcription_jobs',
            'subscription_tiers', 'subscriptions', 'stream_reports',
            'bug_reports', 'user_sessions', 'feature_flags', 'stream_clips',
            'stream_whitelist', 'user_two_factor', 'payouts', 'tip_transactions'
        ) THEN '✅ Created'
        ELSE '❌ Missing'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
