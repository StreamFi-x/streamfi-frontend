-- Purge policies for tables added after 20260925200100_user_tombstones
-- (#1414, #1406, #1446).
--
-- streamfi_purge_user walks every foreign key that references users and
-- aborts the whole purge when one has no policy in its list. Three such keys
-- exist without one:
--   notifications.user_id              (20260926100000, this change)
--   user_recovery_methods.user_id      (20260926000000_wallet_account_recovery)
--   account_recovery_requests.user_id  (20260926000000_wallet_account_recovery)
-- Without this migration every user purge fails with "... references users but
-- has no purge policy in streamfi_purge_user" (reproduced against a database
-- with all migrations applied).
--
-- All three are deleted: notifications hold other users' names and messages
-- (like the users.notifications array the purge already scrubs), and the
-- recovery tables hold the user's recovery data; their foreign keys are already
-- ON DELETE CASCADE.
--
-- The function below is 20260925200100's definition verbatim, with three
-- entries added at the end of the policy list. Idempotent (CREATE OR REPLACE).

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

  -- Archived Livepeer ids (#1408) reference users and stream_sessions without a
  -- foreign key; remove the user's rows before the sessions are deleted.
  IF to_regclass('legacy_livepeer_refs') IS NOT NULL THEN
    DELETE FROM legacy_livepeer_refs
    WHERE (source_table = 'users' AND source_id = d.user_id)
       OR (source_table = 'stream_sessions'
           AND source_id IN (SELECT id FROM stream_sessions WHERE user_id = d.user_id));
    GET DIAGNOSTICS affected = ROW_COUNT;
    summary := summary || jsonb_build_object('legacy_livepeer_refs', affected);
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
      AND con.confrelid = 'users'::regclass
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
      ('route_f_moderation_reports', 'reporter_id',  'delete'),
      ('onboarding_progress',    'user_id',          'delete'),
      ('notifications',          'user_id',          'delete'),
      ('user_recovery_methods',  'user_id',          'delete'),
      ('account_recovery_requests', 'user_id',       'delete')
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

  IF u_email IS NOT NULL AND to_regclass('verification_tokens') IS NOT NULL THEN
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
    ('encrypted_stellar_key_legacy', 'NULL'),
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
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'users'::regclass AND a.attname = s.col AND NOT a.attisdropped
  );

  EXECUTE format('UPDATE users SET %s WHERE id = $1', set_list) USING d.user_id;

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
