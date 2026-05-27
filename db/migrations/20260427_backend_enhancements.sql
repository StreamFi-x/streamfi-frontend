-- 20260427_backend_enhancements.sql

-- 1. Stream Extensions (#535)
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

-- 2. OBS Overlay Config (#459)
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

-- 3. Co-streamer Squads (#465)
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
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(creator_id, user_id)
);

-- 4. Raid Functionality (#463)
CREATE TABLE IF NOT EXISTS raids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raider_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_id UUID REFERENCES users(id) ON DELETE CASCADE,
    viewer_count INTEGER NOT NULL,
    raided_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_acknowledged BOOLEAN DEFAULT FALSE
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_stream_extensions_user ON stream_extensions(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_extensions_enabled ON stream_extensions(is_enabled);
CREATE INDEX IF NOT EXISTS idx_co_stream_invites_creator ON co_stream_invites(creator_id);
CREATE INDEX IF NOT EXISTS idx_co_stream_invites_invitee ON co_stream_invites(invitee_id);
CREATE INDEX IF NOT EXISTS idx_co_stream_invites_status ON co_stream_invites(status);
CREATE INDEX IF NOT EXISTS idx_raids_target ON raids(target_id);
CREATE INDEX IF NOT EXISTS idx_raids_raider ON raids(raider_id);
CREATE INDEX IF NOT EXISTS idx_raids_acknowledged ON raids(is_acknowledged);

-- Default Extensions for catalog
INSERT INTO extension_catalog (name, description, json_schema, icon_url) VALUES
('Tip Alert', 'Shows a popup notification when someone tips', '{"type": "object", "properties": {"duration": {"type": "number", "default": 5}, "sound": {"type": "boolean", "default": true}}}', '/icons/tip-alert.png'),
('Poll Widget', 'Interactive polls for your audience', '{"type": "object", "properties": {"theme": {"type": "string", "default": "dark"}}}', '/icons/poll-widget.png'),
('Chat Box', 'Display chat messages on screen', '{"type": "object", "properties": {"font": {"type": "string", "default": "Inter"}, "opacity": {"type": "number", "default": 0.8}}}', '/icons/chat-box.png')
ON CONFLICT DO NOTHING;
