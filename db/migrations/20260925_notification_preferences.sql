-- ─── Notification Preferences Table ───────────────────────────────────────────
-- Stores per-user notification preferences for all notification types and channels.
-- Migrated from in-memory storage to persistent database.
-- See #1369 and #1370 for context.

CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- In-app notification toggles (default: true)
    notify_follow BOOLEAN DEFAULT TRUE,
    notify_live BOOLEAN DEFAULT TRUE,
    notify_tip_received BOOLEAN DEFAULT TRUE,
    notify_new_subscriber BOOLEAN DEFAULT TRUE,
    notify_clip_featured BOOLEAN DEFAULT TRUE,
    notify_payment_confirmed BOOLEAN DEFAULT TRUE,
    notify_system BOOLEAN DEFAULT TRUE,
    
    -- Email notification toggles (default: varies)
    email_notify_follow BOOLEAN DEFAULT TRUE,
    email_notify_live BOOLEAN DEFAULT FALSE,
    email_notify_tip_received BOOLEAN DEFAULT TRUE,
    email_notify_new_subscriber BOOLEAN DEFAULT FALSE,
    email_notify_clip_featured BOOLEAN DEFAULT FALSE,
    email_notify_payment_confirmed BOOLEAN DEFAULT TRUE,
    
    -- Digest preferences
    email_digest BOOLEAN DEFAULT FALSE,
    
    -- Global opt-out
    unsubscribed_all BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT user_notification_preferences_pkey PRIMARY KEY (user_id)
);

-- Index for performance on lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_unsubscribed ON notification_preferences(unsubscribed_all) 
    WHERE unsubscribed_all = true;

-- Populate defaults for existing users (idempotent)
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;
