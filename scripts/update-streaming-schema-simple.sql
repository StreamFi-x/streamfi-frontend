-- Update database schema for new wallet-based streaming implementation
-- This script adds support for the new v2 streaming APIs while maintaining backward compatibility

-- Add new columns to users table for enhanced streaming support (one by one)
ALTER TABLE users ADD COLUMN IF NOT EXISTS streaming_v2_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_quality VARCHAR(20) DEFAULT 'auto';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_resolution VARCHAR(20) DEFAULT 'auto';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_bitrate INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_fps INTEGER DEFAULT 30;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_audio_codec VARCHAR(20) DEFAULT 'aac';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_video_codec VARCHAR(20) DEFAULT 'h264';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_ingest_type VARCHAR(20) DEFAULT 'rtmp';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_recording_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_multistream_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_analytics_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_chat_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_moderation_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_private BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_password VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_whitelist TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_blacklist TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_metadata JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_settings JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_webhook_url VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_webhook_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_webhook_events TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_analytics_data JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_performance_data JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_last_health_check TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_health_status VARCHAR(20) DEFAULT 'unknown';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_error_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_success_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_total_duration INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_peak_viewers INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_total_views INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_engagement_score DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_quality_score DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_uptime_percentage DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_last_activity TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_auto_start BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_auto_stop BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_auto_stop_duration INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_schedule_start TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_schedule_end TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_schedule_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_schedule_days INTEGER[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_notifications_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_notification_events TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_backup_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_backup_provider VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_backup_config JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_cdn_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_cdn_provider VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_cdn_config JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_transcoding_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_transcoding_profiles JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_adaptive_bitrate BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_adaptive_profiles JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_thumbnail_url VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_thumbnail_auto_generate BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_thumbnail_update_interval INTEGER DEFAULT 30;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_watermark_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_watermark_url VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_watermark_position VARCHAR(20) DEFAULT 'bottom-right';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_watermark_opacity DECIMAL(3,2) DEFAULT 0.50;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_overlay_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_overlay_config JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_chat_bot_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_chat_bot_config JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_moderation_config JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_analytics_config JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_integrations JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_api_keys JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_webhooks JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_events JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_logs JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_metrics JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_health_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_performance_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_analytics_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_error_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_success_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_viewer_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_engagement_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_quality_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_uptime_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_duration_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_bitrate_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_resolution_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_fps_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_audio_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_video_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_network_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_device_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_browser_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_os_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_country_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_city_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_isp_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_mobile_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_desktop_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_tablet_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_tv_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_console_history JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_other_history JSONB DEFAULT '{}';

-- Create new streaming_analytics table for detailed analytics
CREATE TABLE IF NOT EXISTS streaming_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stream_id VARCHAR(255) NOT NULL,
    session_id UUID,
    
    -- Basic metrics
    viewer_count INTEGER DEFAULT 0,
    peak_viewers INTEGER DEFAULT 0,
    total_viewers INTEGER DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    returning_viewers INTEGER DEFAULT 0,
    new_viewers INTEGER DEFAULT 0,
    
    -- Engagement metrics
    total_watch_time INTEGER DEFAULT 0,
    average_watch_time INTEGER DEFAULT 0,
    engagement_score DECIMAL(5,2) DEFAULT 0.00,
    retention_rate DECIMAL(5,2) DEFAULT 0.00,
    bounce_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- Technical metrics
    bitrate INTEGER DEFAULT 0,
    resolution VARCHAR(20),
    fps INTEGER DEFAULT 0,
    audio_codec VARCHAR(20),
    video_codec VARCHAR(20),
    network_latency INTEGER DEFAULT 0,
    buffer_events INTEGER DEFAULT 0,
    quality_score DECIMAL(5,2) DEFAULT 0.00,
    
    -- Geographic metrics
    country VARCHAR(2),
    city VARCHAR(100),
    region VARCHAR(100),
    isp VARCHAR(100),
    
    -- Device metrics
    device_type VARCHAR(20),
    browser VARCHAR(50),
    os VARCHAR(50),
    platform VARCHAR(20),
    
    -- Time metrics
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    duration INTEGER DEFAULT 0,
    
    -- Additional data
    metadata JSONB DEFAULT '{}',
    raw_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create new streaming_health table for health monitoring
CREATE TABLE IF NOT EXISTS streaming_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stream_id VARCHAR(255) NOT NULL,
    session_id UUID,
    
    -- Health status
    status VARCHAR(20) NOT NULL, -- 'healthy', 'warning', 'critical', 'offline'
    is_active BOOLEAN DEFAULT FALSE,
    is_ingesting BOOLEAN DEFAULT FALSE,
    is_playback_available BOOLEAN DEFAULT FALSE,
    
    -- Technical metrics
    ingest_rate DECIMAL(10,2) DEFAULT 0.00,
    outgoing_rate DECIMAL(10,2) DEFAULT 0.00,
    bitrate INTEGER DEFAULT 0,
    resolution VARCHAR(20),
    fps INTEGER DEFAULT 0,
    audio_level DECIMAL(5,2) DEFAULT 0.00,
    video_quality DECIMAL(5,2) DEFAULT 0.00,
    
    -- Network metrics
    latency INTEGER DEFAULT 0,
    packet_loss DECIMAL(5,2) DEFAULT 0.00,
    jitter INTEGER DEFAULT 0,
    bandwidth INTEGER DEFAULT 0,
    
    -- Error tracking
    error_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    last_error VARCHAR(500),
    last_warning VARCHAR(500),
    
    -- Timestamps
    last_seen TIMESTAMP WITH TIME ZONE,
    last_ingest TIMESTAMP WITH TIME ZONE,
    last_playback TIMESTAMP WITH TIME ZONE,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional data
    metadata JSONB DEFAULT '{}',
    raw_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create new streaming_events table for event tracking
CREATE TABLE IF NOT EXISTS streaming_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stream_id VARCHAR(255) NOT NULL,
    session_id UUID,
    
    -- Event details
    event_type VARCHAR(50) NOT NULL, -- 'start', 'stop', 'pause', 'resume', 'error', 'warning', 'viewer_join', 'viewer_leave', etc.
    event_data JSONB DEFAULT '{}',
    event_metadata JSONB DEFAULT '{}',
    
    -- Event context
    triggered_by VARCHAR(50), -- 'user', 'system', 'automation', 'webhook', etc.
    source VARCHAR(100), -- 'api', 'dashboard', 'mobile', 'web', etc.
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamps
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional data
    raw_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create new streaming_webhooks table for webhook management
CREATE TABLE IF NOT EXISTS streaming_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Webhook configuration
    name VARCHAR(100) NOT NULL,
    url VARCHAR(500) NOT NULL,
    secret VARCHAR(255),
    events TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Authentication
    auth_type VARCHAR(20) DEFAULT 'none', -- 'none', 'bearer', 'basic', 'custom'
    auth_config JSONB DEFAULT '{}',
    
    -- Rate limiting
    rate_limit INTEGER DEFAULT 100, -- requests per minute
    rate_limit_window INTEGER DEFAULT 60, -- seconds
    
    -- Retry configuration
    max_retries INTEGER DEFAULT 3,
    retry_delay INTEGER DEFAULT 1000, -- milliseconds
    timeout INTEGER DEFAULT 30000, -- milliseconds
    
    -- Statistics
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    last_request_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional data
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create new streaming_integrations table for third-party integrations
CREATE TABLE IF NOT EXISTS streaming_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Integration details
    provider VARCHAR(50) NOT NULL, -- 'youtube', 'twitch', 'facebook', 'twitter', 'discord', etc.
    integration_type VARCHAR(50) NOT NULL, -- 'multistream', 'notification', 'analytics', 'moderation', etc.
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Configuration
    config JSONB DEFAULT '{}',
    credentials JSONB DEFAULT '{}',
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'error', 'pending'
    last_sync TIMESTAMP WITH TIME ZONE,
    last_error VARCHAR(500),
    error_count INTEGER DEFAULT 0,
    
    -- Statistics
    total_events INTEGER DEFAULT 0,
    successful_events INTEGER DEFAULT 0,
    failed_events INTEGER DEFAULT 0,
    
    -- Additional data
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_streaming_v2_enabled ON users(streaming_v2_enabled);
CREATE INDEX IF NOT EXISTS idx_users_stream_health_status ON users(stream_health_status);
CREATE INDEX IF NOT EXISTS idx_users_stream_last_health_check ON users(stream_last_health_check);
CREATE INDEX IF NOT EXISTS idx_users_stream_last_activity ON users(stream_last_activity);

CREATE INDEX IF NOT EXISTS idx_streaming_analytics_user_id ON streaming_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_streaming_analytics_stream_id ON streaming_analytics(stream_id);
CREATE INDEX IF NOT EXISTS idx_streaming_analytics_session_id ON streaming_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_streaming_analytics_recorded_at ON streaming_analytics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_streaming_analytics_country ON streaming_analytics(country);
CREATE INDEX IF NOT EXISTS idx_streaming_analytics_device_type ON streaming_analytics(device_type);

CREATE INDEX IF NOT EXISTS idx_streaming_health_user_id ON streaming_health(user_id);
CREATE INDEX IF NOT EXISTS idx_streaming_health_stream_id ON streaming_health(stream_id);
CREATE INDEX IF NOT EXISTS idx_streaming_health_session_id ON streaming_health(session_id);
CREATE INDEX IF NOT EXISTS idx_streaming_health_status ON streaming_health(status);
CREATE INDEX IF NOT EXISTS idx_streaming_health_checked_at ON streaming_health(checked_at);

CREATE INDEX IF NOT EXISTS idx_streaming_events_user_id ON streaming_events(user_id);
CREATE INDEX IF NOT EXISTS idx_streaming_events_stream_id ON streaming_events(stream_id);
CREATE INDEX IF NOT EXISTS idx_streaming_events_session_id ON streaming_events(session_id);
CREATE INDEX IF NOT EXISTS idx_streaming_events_event_type ON streaming_events(event_type);
CREATE INDEX IF NOT EXISTS idx_streaming_events_occurred_at ON streaming_events(occurred_at);

CREATE INDEX IF NOT EXISTS idx_streaming_webhooks_user_id ON streaming_webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_streaming_webhooks_is_active ON streaming_webhooks(is_active);

CREATE INDEX IF NOT EXISTS idx_streaming_integrations_user_id ON streaming_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_streaming_integrations_provider ON streaming_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_streaming_integrations_type ON streaming_integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_streaming_integrations_status ON streaming_integrations(status);
