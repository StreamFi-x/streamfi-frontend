-- Update database schema for new wallet-based streaming implementation
-- This script adds support for the new v2 streaming APIs while maintaining backward compatibility

-- Add new columns to users table for enhanced streaming support
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS streaming_v2_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stream_quality VARCHAR(20) DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS stream_resolution VARCHAR(20) DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS stream_bitrate INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stream_fps INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS stream_audio_codec VARCHAR(20) DEFAULT 'aac',
ADD COLUMN IF NOT EXISTS stream_video_codec VARCHAR(20) DEFAULT 'h264',
ADD COLUMN IF NOT EXISTS stream_ingest_type VARCHAR(20) DEFAULT 'rtmp',
ADD COLUMN IF NOT EXISTS stream_recording_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS stream_multistream_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stream_analytics_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS stream_chat_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS stream_moderation_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stream_private BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stream_password VARCHAR(255),
ADD COLUMN IF NOT EXISTS stream_whitelist TEXT[],
ADD COLUMN IF NOT EXISTS stream_blacklist TEXT[],
ADD COLUMN IF NOT EXISTS stream_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_settings JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_webhook_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS stream_webhook_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS stream_webhook_events TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_analytics_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_performance_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_last_health_check TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stream_health_status VARCHAR(20) DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS stream_error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stream_success_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stream_total_duration INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stream_peak_viewers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stream_total_views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stream_engagement_score DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS stream_quality_score DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS stream_uptime_percentage DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS stream_last_activity TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stream_auto_start BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stream_auto_stop BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stream_auto_stop_duration INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stream_schedule_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stream_schedule_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stream_schedule_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stream_schedule_days INTEGER[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_notifications_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS stream_notification_events TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_backup_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stream_backup_provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS stream_backup_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_cdn_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stream_cdn_provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS stream_cdn_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_transcoding_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stream_transcoding_profiles JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_adaptive_bitrate BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stream_adaptive_profiles JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_thumbnail_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS stream_thumbnail_auto_generate BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS stream_thumbnail_update_interval INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS stream_watermark_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stream_watermark_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS stream_watermark_position VARCHAR(20) DEFAULT 'bottom-right',
ADD COLUMN IF NOT EXISTS stream_watermark_opacity DECIMAL(3,2) DEFAULT 0.50,
ADD COLUMN IF NOT EXISTS stream_overlay_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stream_overlay_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_chat_bot_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stream_chat_bot_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_moderation_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_analytics_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_integrations JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_api_keys JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_webhooks JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_events JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_logs JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_health_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_performance_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_analytics_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_error_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_success_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_viewer_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_engagement_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_quality_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_uptime_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_duration_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_bitrate_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_resolution_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_fps_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_audio_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_video_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_network_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_device_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_browser_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_os_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_country_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_city_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_isp_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_mobile_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_desktop_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_tablet_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_tv_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_console_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stream_other_history JSONB DEFAULT '{}';

-- Create new streaming_analytics table for detailed analytics
CREATE TABLE IF NOT EXISTS streaming_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stream_id VARCHAR(255) NOT NULL,
    session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
    
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
    session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
    
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
    session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
    
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

-- Add constraints
ALTER TABLE streaming_analytics ADD CONSTRAINT chk_streaming_analytics_viewer_count CHECK (viewer_count >= 0);
ALTER TABLE streaming_analytics ADD CONSTRAINT chk_streaming_analytics_engagement_score CHECK (engagement_score >= 0 AND engagement_score <= 100);
ALTER TABLE streaming_analytics ADD CONSTRAINT chk_streaming_analytics_retention_rate CHECK (retention_rate >= 0 AND retention_rate <= 100);
ALTER TABLE streaming_analytics ADD CONSTRAINT chk_streaming_analytics_bounce_rate CHECK (bounce_rate >= 0 AND bounce_rate <= 100);

ALTER TABLE streaming_health ADD CONSTRAINT chk_streaming_health_status CHECK (status IN ('healthy', 'warning', 'critical', 'offline'));
ALTER TABLE streaming_health ADD CONSTRAINT chk_streaming_health_ingest_rate CHECK (ingest_rate >= 0);
ALTER TABLE streaming_health ADD CONSTRAINT chk_streaming_health_outgoing_rate CHECK (outgoing_rate >= 0);
ALTER TABLE streaming_health ADD CONSTRAINT chk_streaming_health_audio_level CHECK (audio_level >= 0 AND audio_level <= 100);
ALTER TABLE streaming_health ADD CONSTRAINT chk_streaming_health_video_quality CHECK (video_quality >= 0 AND video_quality <= 100);

ALTER TABLE streaming_webhooks ADD CONSTRAINT chk_streaming_webhooks_rate_limit CHECK (rate_limit > 0);
ALTER TABLE streaming_webhooks ADD CONSTRAINT chk_streaming_webhooks_max_retries CHECK (max_retries >= 0);
ALTER TABLE streaming_webhooks ADD CONSTRAINT chk_streaming_webhooks_retry_delay CHECK (retry_delay > 0);
ALTER TABLE streaming_webhooks ADD CONSTRAINT chk_streaming_webhooks_timeout CHECK (timeout > 0);

ALTER TABLE streaming_integrations ADD CONSTRAINT chk_streaming_integrations_status CHECK (status IN ('active', 'inactive', 'error', 'pending'));

-- Add comments for documentation
COMMENT ON TABLE streaming_analytics IS 'Detailed analytics data for streaming sessions';
COMMENT ON TABLE streaming_health IS 'Health monitoring data for streaming sessions';
COMMENT ON TABLE streaming_events IS 'Event tracking for streaming sessions';
COMMENT ON TABLE streaming_webhooks IS 'Webhook configurations for streaming events';
COMMENT ON TABLE streaming_integrations IS 'Third-party integrations for streaming';

COMMENT ON COLUMN users.streaming_v2_enabled IS 'Whether the user has enabled the new v2 streaming features';
COMMENT ON COLUMN users.stream_quality IS 'Stream quality setting (auto, 720p, 1080p, etc.)';
COMMENT ON COLUMN users.stream_resolution IS 'Stream resolution setting';
COMMENT ON COLUMN users.stream_bitrate IS 'Stream bitrate in kbps';
COMMENT ON COLUMN users.stream_fps IS 'Stream frames per second';
COMMENT ON COLUMN users.stream_audio_codec IS 'Audio codec used for streaming';
COMMENT ON COLUMN users.stream_video_codec IS 'Video codec used for streaming';
COMMENT ON COLUMN users.stream_ingest_type IS 'Type of ingest (rtmp, srt, webrtc, etc.)';
COMMENT ON COLUMN users.stream_recording_enabled IS 'Whether stream recording is enabled';
COMMENT ON COLUMN users.stream_multistream_enabled IS 'Whether multistreaming is enabled';
COMMENT ON COLUMN users.stream_analytics_enabled IS 'Whether analytics collection is enabled';
COMMENT ON COLUMN users.stream_chat_enabled IS 'Whether chat is enabled for the stream';
COMMENT ON COLUMN users.stream_moderation_enabled IS 'Whether moderation is enabled for the stream';
COMMENT ON COLUMN users.stream_private IS 'Whether the stream is private';
COMMENT ON COLUMN users.stream_password IS 'Password for private streams';
COMMENT ON COLUMN users.stream_whitelist IS 'List of allowed wallet addresses for private streams';
COMMENT ON COLUMN users.stream_blacklist IS 'List of blocked wallet addresses';
COMMENT ON COLUMN users.stream_metadata IS 'Additional metadata for the stream';
COMMENT ON COLUMN users.stream_settings IS 'Stream-specific settings';
COMMENT ON COLUMN users.stream_webhook_url IS 'Webhook URL for stream events';
COMMENT ON COLUMN users.stream_webhook_secret IS 'Secret for webhook authentication';
COMMENT ON COLUMN users.stream_webhook_events IS 'List of events to send to webhook';
COMMENT ON COLUMN users.stream_analytics_data IS 'Analytics data for the stream';
COMMENT ON COLUMN users.stream_performance_data IS 'Performance data for the stream';
COMMENT ON COLUMN users.stream_last_health_check IS 'Timestamp of last health check';
COMMENT ON COLUMN users.stream_health_status IS 'Current health status of the stream';
COMMENT ON COLUMN users.stream_error_count IS 'Number of errors encountered';
COMMENT ON COLUMN users.stream_success_count IS 'Number of successful operations';
COMMENT ON COLUMN users.stream_total_duration IS 'Total duration of all streams in seconds';
COMMENT ON COLUMN users.stream_peak_viewers IS 'Peak number of viewers';
COMMENT ON COLUMN users.stream_total_views IS 'Total number of views';
COMMENT ON COLUMN users.stream_engagement_score IS 'Engagement score (0-100)';
COMMENT ON COLUMN users.stream_quality_score IS 'Quality score (0-100)';
COMMENT ON COLUMN users.stream_uptime_percentage IS 'Uptime percentage (0-100)';
COMMENT ON COLUMN users.stream_last_activity IS 'Timestamp of last activity';
COMMENT ON COLUMN users.stream_auto_start IS 'Whether to auto-start streams';
COMMENT ON COLUMN users.stream_auto_stop IS 'Whether to auto-stop streams';
COMMENT ON COLUMN users.stream_auto_stop_duration IS 'Duration before auto-stop in seconds';
COMMENT ON COLUMN users.stream_schedule_start IS 'Scheduled start time';
COMMENT ON COLUMN users.stream_schedule_end IS 'Scheduled end time';
COMMENT ON COLUMN users.stream_schedule_recurring IS 'Whether the schedule is recurring';
COMMENT ON COLUMN users.stream_schedule_days IS 'Days of the week for recurring schedule';
COMMENT ON COLUMN users.stream_notifications_enabled IS 'Whether notifications are enabled';
COMMENT ON COLUMN users.stream_notification_events IS 'List of events to send notifications for';
COMMENT ON COLUMN users.stream_backup_enabled IS 'Whether stream backup is enabled';
COMMENT ON COLUMN users.stream_backup_provider IS 'Backup provider (s3, gcs, etc.)';
COMMENT ON COLUMN users.stream_backup_config IS 'Backup configuration';
COMMENT ON COLUMN users.stream_cdn_enabled IS 'Whether CDN is enabled';
COMMENT ON COLUMN users.stream_cdn_provider IS 'CDN provider';
COMMENT ON COLUMN users.stream_cdn_config IS 'CDN configuration';
COMMENT ON COLUMN users.stream_transcoding_enabled IS 'Whether transcoding is enabled';
COMMENT ON COLUMN users.stream_transcoding_profiles IS 'Transcoding profiles';
COMMENT ON COLUMN users.stream_adaptive_bitrate IS 'Whether adaptive bitrate is enabled';
COMMENT ON COLUMN users.stream_adaptive_profiles IS 'Adaptive bitrate profiles';
COMMENT ON COLUMN users.stream_thumbnail_url IS 'URL of stream thumbnail';
COMMENT ON COLUMN users.stream_thumbnail_auto_generate IS 'Whether to auto-generate thumbnails';
COMMENT ON COLUMN users.stream_thumbnail_update_interval IS 'Thumbnail update interval in seconds';
COMMENT ON COLUMN users.stream_watermark_enabled IS 'Whether watermark is enabled';
COMMENT ON COLUMN users.stream_watermark_url IS 'URL of watermark image';
COMMENT ON COLUMN users.stream_watermark_position IS 'Position of watermark';
COMMENT ON COLUMN users.stream_watermark_opacity IS 'Opacity of watermark (0-1)';
COMMENT ON COLUMN users.stream_overlay_enabled IS 'Whether overlay is enabled';
COMMENT ON COLUMN users.stream_overlay_config IS 'Overlay configuration';
COMMENT ON COLUMN users.stream_chat_bot_enabled IS 'Whether chat bot is enabled';
COMMENT ON COLUMN users.stream_chat_bot_config IS 'Chat bot configuration';
COMMENT ON COLUMN users.stream_moderation_config IS 'Moderation configuration';
COMMENT ON COLUMN users.stream_analytics_config IS 'Analytics configuration';
COMMENT ON COLUMN users.stream_integrations IS 'Third-party integrations';
COMMENT ON COLUMN users.stream_api_keys IS 'API keys for integrations';
COMMENT ON COLUMN users.stream_webhooks IS 'Webhook configurations';
COMMENT ON COLUMN users.stream_events IS 'Stream events';
COMMENT ON COLUMN users.stream_logs IS 'Stream logs';
COMMENT ON COLUMN users.stream_metrics IS 'Stream metrics';
COMMENT ON COLUMN users.stream_health_history IS 'Health check history';
COMMENT ON COLUMN users.stream_performance_history IS 'Performance history';
COMMENT ON COLUMN users.stream_analytics_history IS 'Analytics history';
COMMENT ON COLUMN users.stream_error_history IS 'Error history';
COMMENT ON COLUMN users.stream_success_history IS 'Success history';
COMMENT ON COLUMN users.stream_viewer_history IS 'Viewer history';
COMMENT ON COLUMN users.stream_engagement_history IS 'Engagement history';
COMMENT ON COLUMN users.stream_quality_history IS 'Quality history';
COMMENT ON COLUMN users.stream_uptime_history IS 'Uptime history';
COMMENT ON COLUMN users.stream_duration_history IS 'Duration history';
COMMENT ON COLUMN users.stream_bitrate_history IS 'Bitrate history';
COMMENT ON COLUMN users.stream_resolution_history IS 'Resolution history';
COMMENT ON COLUMN users.stream_fps_history IS 'FPS history';
COMMENT ON COLUMN users.stream_audio_history IS 'Audio history';
COMMENT ON COLUMN users.stream_video_history IS 'Video history';
COMMENT ON COLUMN users.stream_network_history IS 'Network history';
COMMENT ON COLUMN users.stream_device_history IS 'Device history';
COMMENT ON COLUMN users.stream_browser_history IS 'Browser history';
COMMENT ON COLUMN users.stream_os_history IS 'OS history';
COMMENT ON COLUMN users.stream_country_history IS 'Country history';
COMMENT ON COLUMN users.stream_city_history IS 'City history';
COMMENT ON COLUMN users.stream_isp_history IS 'ISP history';
COMMENT ON COLUMN users.stream_mobile_history IS 'Mobile history';
COMMENT ON COLUMN users.stream_desktop_history IS 'Desktop history';
COMMENT ON COLUMN users.stream_tablet_history IS 'Tablet history';
COMMENT ON COLUMN users.stream_tv_history IS 'TV history';
COMMENT ON COLUMN users.stream_console_history IS 'Console history';
COMMENT ON COLUMN users.stream_other_history IS 'Other device history';

