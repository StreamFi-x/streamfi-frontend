-- 20261122140000_fix_user_foreign_keys_on_delete.sql
-- Add ON DELETE CASCADE and SET NULL to user foreign keys and harden deletion (#1868)

-- 1. Dynamically drop existing foreign key constraints on the target columns
-- to ensure clean idempotent re-creation across various environments.
DO $$
DECLARE
  target record;
  fk record;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('subscriptions', 'subscriber_id'),
      ('subscriptions', 'streamer_id'),
      ('subscriptions', 'creator_id'),
      ('chat_messages', 'moderated_by'),
      ('watch_history', 'streamer_id'),
      ('watch_history', 'user_id'),
      ('watch_history', 'viewer_id')
    ) AS t(tbl, col)
  LOOP
    IF to_regclass(format('%I', target.tbl)) IS NOT NULL THEN
      FOR fk IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
        WHERE con.contype = 'f'
          AND con.conrelid = format('%I', target.tbl)::regclass
          AND con.confrelid = 'users'::regclass
          AND array_length(con.conkey, 1) = 1
          AND att.attname = target.col
      LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', target.tbl, fk.conname);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- 2. Explicit ALTER TABLE statements to establish desired CASCADE / SET NULL actions

-- subscriptions: subscriber_id, streamer_id, creator_id -> ON DELETE CASCADE
DO $$
BEGIN
  IF to_regclass('subscriptions') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'subscriptions' AND column_name = 'subscriber_id'
    ) THEN
      ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_subscriber_id_fkey;
      ALTER TABLE subscriptions
        ADD CONSTRAINT subscriptions_subscriber_id_fkey
        FOREIGN KEY (subscriber_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'subscriptions' AND column_name = 'streamer_id'
    ) THEN
      ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_streamer_id_fkey;
      ALTER TABLE subscriptions
        ADD CONSTRAINT subscriptions_streamer_id_fkey
        FOREIGN KEY (streamer_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'subscriptions' AND column_name = 'creator_id'
    ) THEN
      ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_creator_id_fkey;
      ALTER TABLE subscriptions
        ADD CONSTRAINT subscriptions_creator_id_fkey
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- chat_messages: moderated_by -> ON DELETE SET NULL
DO $$
BEGIN
  IF to_regclass('chat_messages') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'chat_messages' AND column_name = 'moderated_by'
    ) THEN
      ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_moderated_by_fkey;
      ALTER TABLE chat_messages
        ADD CONSTRAINT chat_messages_moderated_by_fkey
        FOREIGN KEY (moderated_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- watch_history: streamer_id, user_id, viewer_id -> ON DELETE CASCADE
DO $$
BEGIN
  IF to_regclass('watch_history') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'watch_history' AND column_name = 'streamer_id'
    ) THEN
      ALTER TABLE watch_history DROP CONSTRAINT IF EXISTS watch_history_streamer_id_fkey;
      ALTER TABLE watch_history
        ADD CONSTRAINT watch_history_streamer_id_fkey
        FOREIGN KEY (streamer_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'watch_history' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE watch_history DROP CONSTRAINT IF EXISTS watch_history_user_id_fkey;
      ALTER TABLE watch_history
        ADD CONSTRAINT watch_history_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'watch_history' AND column_name = 'viewer_id'
    ) THEN
      ALTER TABLE watch_history DROP CONSTRAINT IF EXISTS watch_history_viewer_id_fkey;
      ALTER TABLE watch_history
        ADD CONSTRAINT watch_history_viewer_id_fkey
        FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;
