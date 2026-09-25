-- Seed for the chat-poll database benchmark (#1410). Throwaway databases only.
--   psql "$BENCH_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/load-test/chat-seed.sql
--
-- Shape: 50k users, 200 live streams (one with a 20k-message chat, the rest
-- 500 each), 20k ended sessions with 10 messages each. Only the columns the
-- chat routes touch are created. chat_messages.id is an integer because
-- /api/streams/chat pages with `cm.id < $before::int`.

DROP TABLE IF EXISTS chat_messages, stream_sessions, users CASCADE;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  avatar VARCHAR(255),
  mux_playback_id VARCHAR(255),
  is_live BOOLEAN DEFAULT FALSE
);
CREATE TABLE stream_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  total_messages INT DEFAULT 0
);
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  username VARCHAR(255),
  stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'message',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes db/schema.sql already defines for these tables.
CREATE INDEX idx_users_wallet ON users(wallet);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_stream_sessions_user_id ON stream_sessions(user_id);
CREATE INDEX idx_stream_sessions_started_at ON stream_sessions(started_at);
CREATE INDEX idx_chat_messages_stream_session ON chat_messages(stream_session_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX idx_chat_messages_not_deleted ON chat_messages(stream_session_id) WHERE is_deleted = FALSE;

INSERT INTO users (wallet, username, avatar, mux_playback_id, is_live)
SELECT 'G' || lpad(g::text, 55, '0'), 'user' || g, 'https://cdn.example/a/' || g,
       CASE WHEN g <= 200 THEN 'pb' || g END, g <= 200
  FROM generate_series(1, 50000) g;

INSERT INTO stream_sessions (user_id, started_at, ended_at)
SELECT u.id, now() - interval '1 hour', NULL FROM users u WHERE u.is_live;
INSERT INTO stream_sessions (user_id, started_at, ended_at)
SELECT u.id, now() - (g || ' hours')::interval, now() - (g || ' hours')::interval + interval '1 hour'
  FROM users u, generate_series(2, 101) g WHERE u.is_live;

-- Live chats: pb1 is the "viral" stream.
INSERT INTO chat_messages (user_id, username, stream_session_id, content, created_at)
SELECT (SELECT id FROM users WHERE username = 'user' || (1000 + (g % 40000))),
       'user' || (1000 + (g % 40000)), s.id, 'message ' || g,
       now() - interval '1 hour' + (g || ' milliseconds')::interval * 150
  FROM stream_sessions s JOIN users u ON u.id = s.user_id,
       generate_series(1, 20000) g
 WHERE s.ended_at IS NULL AND u.mux_playback_id = 'pb1';
INSERT INTO chat_messages (user_id, username, stream_session_id, content, created_at)
SELECT s.user_id, 'owner', s.id, 'message ' || g, now() - interval '1 hour' + (g || ' seconds')::interval
  FROM stream_sessions s JOIN users u ON u.id = s.user_id, generate_series(1, 500) g
 WHERE s.ended_at IS NULL AND u.mux_playback_id <> 'pb1';
INSERT INTO chat_messages (user_id, username, stream_session_id, content, created_at)
SELECT s.user_id, 'owner', s.id, 'old ' || g, s.started_at + (g || ' minutes')::interval
  FROM stream_sessions s, generate_series(1, 10) g WHERE s.ended_at IS NOT NULL;

VACUUM ANALYZE;
