-- User tombstones, deletion requests and the delayed purge (#1406).
--
-- Lifecycle (user_deletions.status):
--   pending   -> tombstoned (users.deleted_at set), cancellable, waiting for purge_after
--   cancelled -> user restored (users.deleted_at cleared)
--   purging   -> claimed by a purge worker (claimed_until = lease expiry)
--   failed    -> a purge step failed; retried by the next purge run
--   purged    -> personal data removed; the users row remains as a PII-free
--                tombstone so preserved financial/audit rows keep a valid FK
--
-- The users row is never hard-deleted by the purge. Financial foreign keys
-- that used ON DELETE CASCADE are switched to ON DELETE RESTRICT so that an
-- accidental DELETE FROM users can no longer silently erase tip, gift,
-- subscription or payout history.
--
-- Idempotent: safe to run more than once. The CREATE INDEX CONCURRENTLY
-- statements must run outside a transaction (psql -f without -1).

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_deleted_at
  ON users (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_deletions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'cancelled', 'purging', 'failed', 'purged')),
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  requested_by_type TEXT        NOT NULL CHECK (requested_by_type IN ('self', 'admin')),
  requested_by      TEXT,
  reason            TEXT,
  purge_after       TIMESTAMPTZ NOT NULL,
  legal_hold        BOOLEAN     NOT NULL DEFAULT false,
  legal_hold_reason TEXT,
  cancelled_at      TIMESTAMPTZ,
  cancelled_by      TEXT,
  claimed_until     TIMESTAMPTZ,
  attempts          INTEGER     NOT NULL DEFAULT 0,
  completed_steps   TEXT[]      NOT NULL DEFAULT '{}',
  last_error        TEXT,
  purge_summary     JSONB,
  purged_at         TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one open deletion per user. Requesting deletion twice is a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_deletions_open
  ON user_deletions (user_id)
  WHERE status IN ('pending', 'purging', 'failed');

CREATE INDEX IF NOT EXISTS idx_user_deletions_due
  ON user_deletions (purge_after)
  WHERE status IN ('pending', 'purging', 'failed');

-- ── Financial foreign keys: CASCADE -> RESTRICT ──────────────────────────────
DO $$
DECLARE
  target record;
  fk record;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('tip_transactions', 'creator_id'),
      ('gift_transactions', 'creator_id'),
      ('subscriptions', 'creator_id'),
      ('subscriptions', 'subscriber_id'),
      ('subscription_tiers', 'creator_id'),
      ('payouts', 'user_id')
    ) AS t(tbl, col)
  LOOP
    IF to_regclass(format('public.%I', target.tbl)) IS NULL THEN
      CONTINUE;
    END IF;

    FOR fk IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      WHERE con.contype = 'f'
        AND con.conrelid = format('public.%I', target.tbl)::regclass
        AND con.confrelid = 'public.users'::regclass
        AND array_length(con.conkey, 1) = 1
        AND att.attname = target.col
        AND con.confdeltype = 'c'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', target.tbl, fk.conname);
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.users(id) ON DELETE RESTRICT NOT VALID',
        target.tbl, fk.conname, target.col
      );
    END LOOP;
  END LOOP;
END $$;

-- Validate the re-created constraints in a separate transaction so the scan
-- runs under SHARE UPDATE EXCLUSIVE rather than the ACCESS EXCLUSIVE lock
-- taken by ADD CONSTRAINT.
DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT con.conrelid::regclass AS tbl, con.conname
    FROM pg_constraint con
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.users'::regclass
      AND NOT con.convalidated
  LOOP
    EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', fk.tbl, fk.conname);
  END LOOP;
END $$;

-- ── Purge ────────────────────────────────────────────────────────────────────
-- Removes a tombstoned user's personal data in ONE transaction. Every foreign
-- key that references users(id) must have an explicit policy below; an
-- unmapped foreign key (for example a table added later without updating this
-- function) aborts the purge instead of silently skipping data.
--
-- The caller must have claimed the deletion (status = 'purging'). External
-- systems (Mux, Cloudinary) are cleaned up by the application before this
-- function runs; see lib/users/deletion.ts.
CREATE OR REPLACE FUNCTION streamfi_purge_user(p_deletion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  d          user_deletions%ROWTYPE;
  u_deleted  TIMESTAMPTZ;
  u_email    TEXT;
  fk         record;
  policy     TEXT;
  affected   INTEGER;
  summary    JSONB := '{}'::jsonb;
  set_list   TEXT;
  suffix     TEXT;
BEGIN
  SELECT * INTO d FROM user_deletions WHERE id = p_deletion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'deletion % not found', p_deletion_id;
  END IF;
  IF d.status <> 'purging' THEN
    RAISE EXCEPTION 'deletion % is %, expected purging', p_deletion_id, d.status;
  END IF;
  IF d.legal_hold THEN
    RAISE EXCEPTION 'deletion % is under legal hold', p_deletion_id;
  END IF;

  SELECT deleted_at, email INTO u_deleted, u_email
  FROM users WHERE id = d.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user % not found', d.user_id;
  END IF;
  IF u_deleted IS NULL THEN
    RAISE EXCEPTION 'user % is not tombstoned', d.user_id;
  END IF;

  FOR fk IN
    SELECT
      con.conname,
      rel.relname AS tbl,
      nsp.nspname AS sch,
      array_length(con.conkey, 1) AS ncols,
      (SELECT att.attname FROM pg_attribute att
        WHERE att.attrelid = con.conrelid AND att.attnum = con.conkey[1]) AS col
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.users'::regclass
    ORDER BY rel.relname, con.conname
  LOOP
    IF fk.ncols <> 1 THEN
      RAISE EXCEPTION 'purge aborted: multi-column foreign key %.% references users', fk.tbl, fk.conname;
    END IF;

    SELECT p.action INTO policy FROM (VALUES
      ('stream_sessions',        'user_id',          'delete'),
      ('chat_messages',          'user_id',          'delete'),
      ('chat_messages',          'moderated_by',     'nullify'),
      ('stream_viewers',         'user_id',          'nullify'),
      ('user_follows',           'follower_id',      'delete'),
      ('user_follows',           'followee_id',      'delete'),
      ('stream_recordings',      'user_id',          'delete'),
      ('stream_schedule',        'creator_id',       'delete'),
      ('stream_reminders',       'viewer_id',        'delete'),
      ('user_badges',            'user_id',          'delete'),
      ('stream_tags',            'stream_id',        'delete'),
      ('tag_suggestions',        'suggested_by',     'delete'),
      ('channel_emotes',         'creator_id',       'delete'),
      ('mock_tip_transactions',  'creator_id',       'delete'),
      ('mock_tip_transactions',  'viewer_id',        'nullify'),
      ('mock_gift_transactions', 'creator_id',       'delete'),
      ('mock_gift_transactions', 'viewer_id',        'nullify'),
      ('moderation_queue',       'reporter_id',      'nullify'),
      ('moderation_queue',       'reported_user_id', 'nullify'),
      ('moderation_queue',       'assigned_to',      'nullify'),
      ('moderation_audit_log',   'moderator_id',     'nullify'),
      ('tip_transactions',       'creator_id',       'preserve'),
      ('tip_transactions',       'supporter_id',     'preserve'),
      ('gift_transactions',      'creator_id',       'preserve'),
      ('gift_transactions',      'supporter_id',     'preserve'),
      ('subscriptions',          'creator_id',       'preserve'),
      ('subscriptions',          'supporter_id',     'preserve'),
      ('subscriptions',          'subscriber_id',    'preserve'),
      ('subscriptions',          'streamer_id',      'preserve'),
      ('subscription_tiers',     'creator_id',       'preserve'),
      ('payouts',                'user_id',          'preserve'),
      ('user_deletions',         'user_id',          'preserve'),
      ('route_f_revenue_events', 'channel_id',       'preserve'),
      ('users',                  'referred_by',      'nullify'),
      ('stream_clips',           'clipped_by',       'delete'),
      ('stream_clips',           'streamer_id',      'delete'),
      ('stream_whitelist',       'streamer_id',      'delete'),
      ('stream_whitelist',       'user_id',          'delete'),
      ('stream_markers',         'user_id',          'delete'),
      ('stream_extensions',      'user_id',          'delete'),
      ('channel_panels',         'channel_id',       'delete'),
      ('co_stream_invites',      'creator_id',       'delete'),
      ('co_stream_invites',      'invitee_id',       'delete'),
      ('raids',                  'raider_id',        'delete'),
      ('raids',                  'target_id',        'delete'),
      ('squad_members',          'creator_id',       'delete'),
      ('squad_members',          'user_id',          'delete'),
      ('watch_history',          'viewer_id',        'delete'),
      ('watch_history',          'streamer_id',      'delete'),
      ('user_preferences',       'user_id',          'delete'),
      ('user_overlay_config',    'user_id',          'delete'),
      ('user_sessions',          'user_id',          'delete'),
      ('user_two_factor',        'user_id',          'delete'),
      ('email_verification_tokens', 'user_id',       'delete'),
      ('magic_link_tokens',      'user_id',          'delete'),
      ('password_reset_tokens',  'user_id',          'delete'),
      ('transcription_jobs',     'user_id',          'delete'),
      ('experiment_events',      'user_id',          'delete'),
      ('user_experiment_assignments', 'user_id',     'delete'),
      ('route_f_broadcast_sessions', 'creator_id',   'delete'),
      ('route_f_clips',          'creator_id',       'delete'),
      ('route_f_follow_events',  'creator_id',       'delete'),
      ('route_f_follow_events',  'follower_id',      'delete'),
      ('route_f_watch_events',   'user_id',          'delete'),
      ('route_f_watch_events',   'stream_id',        'delete'),
      ('route_f_moderation_reports', 'creator_id',   'delete'),
      ('route_f_moderation_reports', 'reporter_id',  'delete')
    ) AS p(tbl, col, action)
    WHERE p.tbl = fk.tbl AND p.col = fk.col;

    IF policy IS NULL THEN
      RAISE EXCEPTION 'purge aborted: foreign key %.%(%) references users but has no purge policy in streamfi_purge_user',
        fk.tbl, fk.conname, fk.col;
    END IF;

    IF policy = 'delete' THEN
      EXECUTE format('DELETE FROM %I.%I WHERE %I = $1', fk.sch, fk.tbl, fk.col) USING d.user_id;
    ELSIF policy = 'nullify' THEN
      EXECUTE format('UPDATE %I.%I SET %I = NULL WHERE %I = $1', fk.sch, fk.tbl, fk.col, fk.col) USING d.user_id;
    ELSE
      CONTINUE;
    END IF;

    GET DIAGNOSTICS affected = ROW_COUNT;
    summary := summary || jsonb_build_object(fk.tbl || '.' || fk.col, affected);
  END LOOP;

  IF u_email IS NOT NULL AND to_regclass('public.verification_tokens') IS NOT NULL THEN
    DELETE FROM verification_tokens WHERE email = u_email;
    GET DIAGNOSTICS affected = ROW_COUNT;
    summary := summary || jsonb_build_object('verification_tokens.email', affected);
  END IF;

  -- Scrub the users row. Only columns that exist in this deployment are
  -- touched; unique identifiers are replaced with non-identifying values so
  -- the email/wallet/username can be registered again.
  suffix := replace(d.user_id::text, '-', '');
  SELECT string_agg(format('%I = %s', s.col, s.expr), ', ')
  INTO set_list
  FROM (VALUES
    ('username',               quote_literal('deleted_' || suffix)),
    ('wallet',                 quote_literal('purged_' || suffix)),
    ('email',                  'NULL'),
    ('privy_id',               'NULL'),
    ('encrypted_stellar_key',  'NULL'),
    ('streamkey',              'NULL'),
    ('avatar',                 'NULL'),
    ('banner',                 'NULL'),
    ('bio',                    'NULL'),
    ('sociallinks',            quote_literal('{}') || '::jsonb'),
    ('creator',                quote_literal('{}') || '::jsonb'),
    ('notifications',          quote_literal('{}') || '::jsonb[]'),
    ('categories',             'NULL'),
    ('followers',              'NULL'),
    ('following',              'NULL'),
    ('mux_stream_id',          'NULL'),
    ('mux_playback_id',        'NULL'),
    ('mux_stream_key',         'NULL'),
    ('mux_signed_playback_id', 'NULL'),
    ('share_token',            'NULL'),
    ('livepeer_stream_id',     'NULL'),
    ('playback_id',            'NULL'),
    ('ban_reason',             'NULL'),
    ('is_live',                'false'),
    ('current_viewers',        '0'),
    ('stream_started_at',      'NULL'),
    ('emailverified',          'false'),
    ('emailnotifications',     'false'),
    ('updated_at',             'now()')
  ) AS s(col, expr)
  WHERE EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'users' AND c.column_name = s.col
  );

  EXECUTE format('UPDATE public.users SET %s WHERE id = $1', set_list) USING d.user_id;

  UPDATE user_deletions
  SET status = 'purged',
      purged_at = now(),
      claimed_until = NULL,
      last_error = NULL,
      completed_steps = ARRAY(SELECT DISTINCT unnest(array_append(completed_steps, 'database'))),
      purge_summary = summary,
      updated_at = now()
  WHERE id = p_deletion_id;

  RETURN summary;
END;
$$;
