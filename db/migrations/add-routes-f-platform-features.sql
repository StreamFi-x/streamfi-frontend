CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stream_tags (
  stream_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
  applied_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (stream_id, tag_id)
);

CREATE INDEX IF NOT EXISTS tags_name_trgm ON tags USING gin(name gin_trgm_ops);
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

CREATE TABLE IF NOT EXISTS mock_tip_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount_xlm NUMERIC(20,7) NOT NULL,
  tx_hash TEXT,
  mock BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mock_gift_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  tier TEXT NOT NULL,
  amount_usdc NUMERIC(20,7) NOT NULL,
  tx_hash TEXT,
  mock BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
