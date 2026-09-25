-- Database test for db/migrations/20260925190100_retire_livepeer_columns.sql (#1408).
-- Each include is wrapped in a transaction, as the migration runner does.
--
-- Runs entirely inside a throwaway schema, so it is safe on any disposable
-- database (never production):
--   psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/retire-livepeer-columns.test.sql
--
-- Covers: migrated / unprovisioned / legacy_history / clean rows, empty-string
-- legacy values, Mux values left untouched, no rows deleted, idempotent rerun,
-- the abort guard, and a database that never had the legacy columns.

\set ON_ERROR_STOP 1
DROP SCHEMA IF EXISTS livepeer_migration_test CASCADE;
CREATE SCHEMA livepeer_migration_test;
SET search_path = livepeer_migration_test, public;

-- Shape of a pre-Mux production database (old schema.sql + /api/debug/fix-db).
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  livepeer_stream_id VARCHAR(255),
  playback_id VARCHAR(255),
  mux_stream_id VARCHAR(255),
  mux_playback_id VARCHAR(255)
);
CREATE TABLE stream_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  livepeer_session_id VARCHAR(255),
  livepeer_stream_id VARCHAR(255),
  mux_session_id VARCHAR(255),
  playback_id VARCHAR(255)
);
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL
);
CREATE INDEX idx_users_livepeer_stream_id ON users(livepeer_stream_id);
CREATE INDEX idx_users_livepeer ON users(livepeer_stream_id);
CREATE INDEX idx_users_playback_id ON users(playback_id);
CREATE INDEX idx_stream_sessions_livepeer_session ON stream_sessions(livepeer_session_id);

INSERT INTO users (username, livepeer_stream_id, playback_id, mux_stream_id, mux_playback_id) VALUES
  ('migrated',      'lp-stream-a', 'lp-play-a', 'mux-stream-a', 'mux-play-a'),
  ('unprovisioned', 'lp-stream-b', 'lp-play-b', NULL,           NULL),
  ('clean',         NULL,          NULL,        'mux-stream-c', 'mux-play-c'),
  ('playback-only', NULL,          'lp-play-d', NULL,           NULL),
  ('empty-legacy',  '',            '',          NULL,           NULL);

INSERT INTO stream_sessions (user_id, livepeer_session_id, livepeer_stream_id, mux_session_id, playback_id)
SELECT id, 'lp-sess-a', 'lp-stream-a', 'mux-sess-a', 'mux-play-a' FROM users WHERE username = 'migrated'
UNION ALL
SELECT id, 'lp-sess-b', 'lp-stream-b', NULL, 'lp-play-b' FROM users WHERE username = 'unprovisioned'
UNION ALL
SELECT id, NULL, NULL, 'mux-sess-c', 'mux-play-c' FROM users WHERE username = 'clean';

INSERT INTO chat_messages (stream_session_id, content)
SELECT id, 'history survives' FROM stream_sessions;

CREATE TEMP TABLE before_mux AS
  SELECT 'users' AS t, id, mux_stream_id AS a, mux_playback_id AS b FROM users
  UNION ALL
  SELECT 'stream_sessions', id, mux_session_id, playback_id FROM stream_sessions;

-- ── Run 1 ────────────────────────────────────────────────────────────────────
BEGIN;
\ir ../migrations/20260925190100_retire_livepeer_columns.sql
COMMIT;

DO $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM information_schema.columns
   WHERE table_schema = current_schema()
     AND column_name IN ('livepeer_stream_id', 'livepeer_session_id')
      OR (table_schema = current_schema() AND table_name = 'users' AND column_name = 'playback_id');
  IF n <> 0 THEN RAISE EXCEPTION 'legacy columns still present: %', n; END IF;

  IF to_regclass('idx_users_livepeer_stream_id') IS NOT NULL
     OR to_regclass('idx_users_livepeer') IS NOT NULL
     OR to_regclass('idx_users_playback_id') IS NOT NULL
     OR to_regclass('idx_stream_sessions_livepeer_session') IS NOT NULL THEN
    RAISE EXCEPTION 'legacy index still present';
  END IF;

  -- stream_sessions.playback_id holds Mux playback IDs today; it must survive.
  PERFORM 1 FROM information_schema.columns
   WHERE table_schema = current_schema()
     AND table_name = 'stream_sessions' AND column_name = 'playback_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'stream_sessions.playback_id was dropped'; END IF;

  SELECT COUNT(*) INTO n FROM users;
  IF n <> 5 THEN RAISE EXCEPTION 'users deleted: % left', n; END IF;
  SELECT COUNT(*) INTO n FROM stream_sessions;
  IF n <> 3 THEN RAISE EXCEPTION 'sessions deleted: % left', n; END IF;
  SELECT COUNT(*) INTO n FROM chat_messages;
  IF n <> 3 THEN RAISE EXCEPTION 'chat history lost: % left', n; END IF;

  SELECT COUNT(*) INTO n FROM (
    SELECT 'users' AS t, id, mux_stream_id AS a, mux_playback_id AS b FROM users
    UNION ALL
    SELECT 'stream_sessions', id, mux_session_id, playback_id FROM stream_sessions
  ) after_mux FULL JOIN before_mux USING (t, id)
  WHERE after_mux.a IS DISTINCT FROM before_mux.a
     OR after_mux.b IS DISTINCT FROM before_mux.b;
  IF n <> 0 THEN RAISE EXCEPTION 'Mux values changed on % rows', n; END IF;
END $$;

-- Expected archive: 3 values from 'migrated' + 'unprovisioned' users each has
-- 2, 'playback-only' has 1, empty strings are skipped; sessions a and b have 2.
DO $$
DECLARE got TEXT;
BEGIN
  SELECT string_agg(format('%s.%s=%s:%s', source_table, column_name, legacy_value, disposition),
                    ',' ORDER BY source_table, column_name, legacy_value)
    INTO got FROM legacy_livepeer_refs;
  IF got IS DISTINCT FROM
     'stream_sessions.livepeer_session_id=lp-sess-a:migrated,' ||
     'stream_sessions.livepeer_session_id=lp-sess-b:legacy_history,' ||
     'stream_sessions.livepeer_stream_id=lp-stream-a:migrated,' ||
     'stream_sessions.livepeer_stream_id=lp-stream-b:legacy_history,' ||
     'users.livepeer_stream_id=lp-stream-a:migrated,' ||
     'users.livepeer_stream_id=lp-stream-b:unprovisioned,' ||
     'users.playback_id=lp-play-a:migrated,' ||
     'users.playback_id=lp-play-b:unprovisioned,' ||
     'users.playback_id=lp-play-d:unprovisioned'
  THEN
    RAISE EXCEPTION 'unexpected archive contents: %', got;
  END IF;

  PERFORM 1 FROM legacy_livepeer_refs
   WHERE column_name = 'livepeer_stream_id' AND legacy_value = 'lp-stream-a'
     AND source_table = 'users' AND mux_reference = 'mux-stream-a';
  IF NOT FOUND THEN RAISE EXCEPTION 'mux_reference not recorded'; END IF;
END $$;

-- ── Run 2: idempotent ────────────────────────────────────────────────────────
BEGIN;
\ir ../migrations/20260925190100_retire_livepeer_columns.sql
COMMIT;

DO $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM legacy_livepeer_refs;
  IF n <> 9 THEN RAISE EXCEPTION 'rerun changed archive: % rows', n; END IF;
END $$;

-- ── Abort guard: a value that cannot be archived blocks every DROP ─────────
DROP TABLE legacy_livepeer_refs;
ALTER TABLE users ADD COLUMN livepeer_stream_id VARCHAR(255);
UPDATE users SET livepeer_stream_id = 'lp-new' WHERE username = 'unprovisioned';
CREATE TABLE legacy_livepeer_refs (
  id BIGSERIAL PRIMARY KEY, source_table TEXT NOT NULL, source_id UUID NOT NULL,
  column_name TEXT NOT NULL, legacy_value TEXT NOT NULL, mux_reference TEXT,
  disposition TEXT NOT NULL, archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_table, source_id, column_name)
);
-- A stale archive row with a different value makes ON CONFLICT skip the real one.
INSERT INTO legacy_livepeer_refs (source_table, source_id, column_name, legacy_value, disposition)
SELECT 'users', id, 'livepeer_stream_id', 'lp-stale', 'unprovisioned'
  FROM users WHERE username = 'unprovisioned';

BEGIN;
\set ON_ERROR_STOP 0
\ir ../migrations/20260925190100_retire_livepeer_columns.sql
\set ON_ERROR_STOP 1
ROLLBACK;

DO $$
BEGIN
  PERFORM 1 FROM information_schema.columns
   WHERE table_schema = current_schema()
     AND table_name = 'users' AND column_name = 'livepeer_stream_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'guard failed: column dropped despite unarchived value'; END IF;
END $$;

-- ── A database that never had the legacy columns ────────────────────────────
DROP SCHEMA livepeer_migration_test CASCADE;
CREATE SCHEMA livepeer_migration_test;
SET search_path = livepeer_migration_test, public;
CREATE TABLE users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), mux_stream_id TEXT);
CREATE TABLE stream_sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), mux_session_id TEXT);
BEGIN;
\ir ../migrations/20260925190100_retire_livepeer_columns.sql
COMMIT;
DO $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM legacy_livepeer_refs;
  IF n <> 0 THEN RAISE EXCEPTION 'clean database archived % rows', n; END IF;
END $$;

DROP SCHEMA livepeer_migration_test CASCADE;
\echo 'retire-livepeer-columns: all assertions passed'
