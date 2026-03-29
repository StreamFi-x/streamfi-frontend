CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE notification_type AS ENUM (
    'new_follower',
    'tip_received',
    'stream_live',
    'stream_ended',
    'recording_ready'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS notification_preferences JSONB;

UPDATE users
SET notification_preferences = jsonb_build_object(
  'newFollower', true,
  'tipReceived', true,
  'streamLive', true,
  'recordingReady', true,
  'emailNotifications', COALESCE(emailnotifications, true)
)
WHERE notification_preferences IS NULL;

ALTER TABLE users
ALTER COLUMN notification_preferences
SET DEFAULT jsonb_build_object(
  'newFollower', true,
  'tipReceived', true,
  'streamLive', true,
  'recordingReady', true,
  'emailNotifications', true
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB,
  dedupe_key TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_key_unique
ON notifications(user_id, dedupe_key);

CREATE INDEX IF NOT EXISTS notifications_user_unread
ON notifications(user_id, read, created_at DESC);

INSERT INTO notifications (id, user_id, type, title, body, metadata, read, created_at)
SELECT
  COALESCE((legacy_notification ->> 'id')::uuid, gen_random_uuid()),
  u.id,
  CASE legacy_notification ->> 'type'
    WHEN 'follow' THEN 'new_follower'::notification_type
    WHEN 'live' THEN 'stream_live'::notification_type
    ELSE 'recording_ready'::notification_type
  END,
  COALESCE(legacy_notification ->> 'title', 'Notification'),
  COALESCE(legacy_notification ->> 'text', legacy_notification ->> 'body'),
  legacy_notification - 'id' - 'type' - 'title' - 'text' - 'body' - 'read' - 'created_at',
  COALESCE((legacy_notification ->> 'read')::boolean, false),
  COALESCE((legacy_notification ->> 'created_at')::timestamptz, now())
FROM users u
CROSS JOIN LATERAL unnest(COALESCE(u.notifications, ARRAY[]::jsonb[])) AS legacy_notification
ON CONFLICT (id) DO NOTHING;