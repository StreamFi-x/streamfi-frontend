-- Database-level tests for Issue #1868: Foreign key cascades on user deletion.
--
-- Run against a disposable database that has the schema and migrations applied:
--   psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/user-deletion-cascades.test.sql
--
-- Runs in a single transaction that is rolled back at the end. Failing ASSERT aborts.

BEGIN;

-- 1. Create test users
INSERT INTO users (id, wallet, username, email) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'GUSER1_CREATOR_TEST', 'creator_user', 'creator@streamfi.test'),
  ('d0000000-0000-0000-0000-000000000002', 'GUSER2_SUBSCRIBER_TEST', 'subscriber_user', 'subscriber@streamfi.test'),
  ('d0000000-0000-0000-0000-000000000003', 'GUSER3_MODERATOR_TEST', 'moderator_user', 'moderator@streamfi.test');

-- 2. Verify chat_messages: moderated_by foreign key has confdeltype = 'n' (SET NULL)
DO $$
DECLARE
  deltype "char";
BEGIN
  SELECT confdeltype INTO deltype
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  WHERE c.conrelid = 'chat_messages'::regclass
    AND a.attname = 'moderated_by'
    AND c.contype = 'f';

  ASSERT deltype = 'n', 'chat_messages.moderated_by constraint must be ON DELETE SET NULL (n)';
END $$;

-- 3. Verify watch_history: streamer_id foreign key has confdeltype = 'c' (CASCADE)
DO $$
DECLARE
  deltype "char";
BEGIN
  SELECT confdeltype INTO deltype
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  WHERE c.conrelid = 'watch_history'::regclass
    AND a.attname = 'streamer_id'
    AND c.contype = 'f';

  ASSERT deltype = 'c', 'watch_history.streamer_id constraint must be ON DELETE CASCADE (c)';
END $$;

-- 4. Verify subscriptions: subscriber_id foreign key has confdeltype = 'c' (CASCADE)
DO $$
DECLARE
  deltype "char";
BEGIN
  SELECT confdeltype INTO deltype
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  WHERE c.conrelid = 'subscriptions'::regclass
    AND a.attname = 'subscriber_id'
    AND c.contype = 'f';

  ASSERT deltype = 'c', 'subscriptions.subscriber_id constraint must be ON DELETE CASCADE (c)';
END $$;

-- 5. Test inserting dependent rows and verifying ON DELETE CASCADE / SET NULL behaviors
INSERT INTO subscriptions (subscriber_id, creator_id, expires_at, status) VALUES
  ('d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', now() + interval '30 days', 'active');

INSERT INTO chat_messages (user_id, content, is_moderated, moderated_by) VALUES
  ('d0000000-0000-0000-0000-000000000002', 'Test message to be moderated', true, 'd0000000-0000-0000-0000-000000000003');

INSERT INTO watch_history (viewer_id, streamer_id, stream_type, stream_title, watch_seconds) VALUES
  ('d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'live', 'Live Coding Session', 120);

-- Deleting moderator must SET NULL on chat_messages.moderated_by without deleting the message
DELETE FROM users WHERE id = 'd0000000-0000-0000-0000-000000000003';

DO $$
DECLARE
  msg_count INT;
  mod_val UUID;
BEGIN
  SELECT COUNT(*), (ARRAY_AGG(moderated_by))[1] INTO msg_count, mod_val
  FROM chat_messages
  WHERE content = 'Test message to be moderated';

  ASSERT msg_count = 1, 'chat message must still exist after moderator deletion';
  ASSERT mod_val IS NULL, 'moderated_by must be set to NULL after moderator deletion';
END $$;

-- Deleting creator must CASCADE subscriptions and watch_history where streamer_id = creator
DELETE FROM users WHERE id = 'd0000000-0000-0000-0000-000000000001';

DO $$
DECLARE
  sub_count INT;
  wh_count INT;
BEGIN
  SELECT COUNT(*) INTO sub_count FROM subscriptions WHERE creator_id = 'd0000000-0000-0000-0000-000000000001';
  SELECT COUNT(*) INTO wh_count FROM watch_history WHERE streamer_id = 'd0000000-0000-0000-0000-000000000001';

  ASSERT sub_count = 0, 'subscriptions for deleted creator must cascade';
  ASSERT wh_count = 0, 'watch_history for deleted streamer must cascade';
END $$;

-- Deleting subscriber must CASCADE remaining subscriptions and watch_history
DELETE FROM users WHERE id = 'd0000000-0000-0000-0000-000000000002';

DO $$
DECLARE
  wh_count INT;
BEGIN
  SELECT COUNT(*) INTO wh_count FROM watch_history WHERE viewer_id = 'd0000000-0000-0000-0000-000000000002';

  ASSERT wh_count = 0, 'watch_history for deleted viewer must cascade';
END $$;

ROLLBACK;
