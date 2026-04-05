-- Activity events table for user activity feed
-- Tracks follows, tips, gifts, streams, and other user-facing events.

CREATE TABLE IF NOT EXISTS route_f_activity_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(30) NOT NULL,
  actor_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_f_activity_user_feed
  ON route_f_activity_events (user_id, created_at DESC);
