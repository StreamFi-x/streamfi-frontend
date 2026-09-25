-- Database-level tests for the data-integrity migrations (#1405, #1406, #1407, #1409).
--
-- Run against a DISPOSABLE database that has the schema and every migration
-- applied (`npm run db:migrate`, including the 20260925110000..120100 files):
--
--   psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/data-integrity.test.sql
--
-- Everything runs in one transaction that is rolled back at the end. A failing
-- ASSERT aborts with the assertion message.

BEGIN;

-- ── fixtures ─────────────────────────────────────────────────────────────────
-- referred_by is provisioned by hand (see app/api/routes-f/referrals/route.ts).
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id);
INSERT INTO users (id, wallet, username, email, sociallinks, creator, notifications, mux_stream_id) VALUES
  ('a0000000-0000-0000-0000-00000000000c', 'GTESTCREATOR', 'test_creator', 'creator@test.invalid',
   '{"twitter":"https://x.com/c"}', '{"streamTitle":"hi"}', '{}', 'test-ls-1'),
  ('a0000000-0000-0000-0000-00000000000e', 'GTESTSUPPORTER', 'test_supporter', 'supporter@test.invalid',
   '[{"socialTitle":"x","socialLink":"https://x.com/s"}]', '{"title":"legacy"}',
   ARRAY['{"title":"a","text":"b"}'::jsonb], NULL);

-- ── #1407 JSONB contracts ────────────────────────────────────────────────────
DO $$
BEGIN
  ASSERT streamfi_jsonb_sociallinks_ok('{"x":"https://x.com"}'), 'map accepted';
  ASSERT streamfi_jsonb_sociallinks_ok('[{"socialTitle":"x","socialLink":"y"}]'), 'legacy array accepted';
  ASSERT NOT streamfi_jsonb_sociallinks_ok('"double-encoded"'), 'string scalar rejected';
  ASSERT NOT streamfi_jsonb_sociallinks_ok('{"x":1}'), 'non-string value rejected';
  ASSERT NOT streamfi_jsonb_creator_ok('{"tags":"a,b"}'), 'non-array tags rejected';
  ASSERT NOT streamfi_jsonb_creator_ok('{"tags":[1]}'), 'non-string tag rejected';
  ASSERT NOT streamfi_jsonb_creator_ok('[]'), 'array creator rejected';
  ASSERT streamfi_jsonb_creator_ok('{"streamTitle":"t","thumbnail":null,"unknown":1}'), 'known keys typed, unknown left to app';
  ASSERT NOT streamfi_jsonb_notifications_ok(ARRAY['{"title":"a"}'::jsonb]), 'notification without text rejected';
  ASSERT NOT streamfi_jsonb_notifications_ok(ARRAY['{"title":"a","text":"b","read":"no"}'::jsonb]), 'non-boolean read rejected';
END $$;

-- Legacy rows stay updatable under the constraints.
UPDATE users SET is_live = true WHERE id = 'a0000000-0000-0000-0000-00000000000e';

DO $$
BEGIN
  BEGIN
    UPDATE users SET sociallinks = '"oops"' WHERE id = 'a0000000-0000-0000-0000-00000000000c';
    RAISE EXCEPTION 'sociallinks constraint did not fire';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE users SET creator = '{"tags":"x"}' WHERE id = 'a0000000-0000-0000-0000-00000000000c';
    RAISE EXCEPTION 'creator constraint did not fire';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE users SET notifications = notifications || '"junk"'::jsonb WHERE id = 'a0000000-0000-0000-0000-00000000000c';
    RAISE EXCEPTION 'notifications constraint did not fire';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- ── #1406 tombstones and purge ───────────────────────────────────────────────
INSERT INTO stream_sessions (id, user_id) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000c');
INSERT INTO chat_messages (user_id, stream_session_id, content) VALUES
  ('a0000000-0000-0000-0000-00000000000e', 'b0000000-0000-0000-0000-000000000001', 'in creator stream');
INSERT INTO chat_messages (user_id, content, moderated_by) VALUES
  ('a0000000-0000-0000-0000-00000000000e', 'elsewhere', 'a0000000-0000-0000-0000-00000000000c');
INSERT INTO tip_transactions (creator_id, supporter_id, amount_xlm, tx_hash) VALUES
  ('a0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000e', 5.1234567, 'test-tx-1');
INSERT INTO payouts (user_id, amount_usdc, method, destination, net_usdc) VALUES
  ('a0000000-0000-0000-0000-00000000000c', 10, 'stellar_wallet', 'GDEST', 10);
INSERT INTO user_follows (follower_id, followee_id) VALUES
  ('a0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000c');
INSERT INTO stream_recordings (user_id, mux_asset_id, playback_id) VALUES
  ('a0000000-0000-0000-0000-00000000000c', 'test-asset-1', 'test-pb-1');
INSERT INTO stream_clips (clipped_by, streamer_id, start_offset, duration, mux_asset_id) VALUES
  ('a0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000c', 0, 30, 'test-clip-asset');
UPDATE users SET referred_by = 'a0000000-0000-0000-0000-00000000000c'
WHERE id = 'a0000000-0000-0000-0000-00000000000e';

-- Financial FKs no longer cascade.
DO $$
BEGIN
  ASSERT (SELECT confdeltype FROM pg_constraint c
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
          WHERE c.conrelid = 'tip_transactions'::regclass AND a.attname = 'creator_id'
            AND c.contype = 'f') = 'r', 'tip_transactions.creator_id is RESTRICT';
  BEGIN
    DELETE FROM users WHERE id = 'a0000000-0000-0000-0000-00000000000c';
    RAISE EXCEPTION 'hard delete of a user with financial history succeeded';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

-- Request: tombstone + pending deletion, idempotent.
INSERT INTO user_deletions (id, user_id, requested_by_type, purge_after)
VALUES ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000c', 'self', now() - interval '1 minute');
UPDATE users SET deleted_at = now() WHERE id = 'a0000000-0000-0000-0000-00000000000c';
DO $$
BEGIN
  BEGIN
    INSERT INTO user_deletions (user_id, requested_by_type, purge_after)
    VALUES ('a0000000-0000-0000-0000-00000000000c', 'self', now());
    RAISE EXCEPTION 'second open deletion allowed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

-- The purge requires a claim, an unheld legal hold and a mapped FK graph.
DO $$
BEGIN
  BEGIN
    PERFORM streamfi_purge_user('c0000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'purge ran without a claim';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%expected purging%' THEN RAISE; END IF;
  END;
END $$;

-- Claim (same statement shape as lib/users/deletion.ts).
UPDATE user_deletions
SET status = 'purging', claimed_until = now() + interval '15 minutes', attempts = attempts + 1
WHERE id IN (
  SELECT id FROM user_deletions
  WHERE purge_after <= now() AND legal_hold = false AND attempts < 5
    AND (status IN ('pending', 'failed') OR (status = 'purging' AND claimed_until < now()))
  FOR UPDATE SKIP LOCKED
);

DO $$
DECLARE
  cancelled integer;
BEGIN
  -- Cancel loses against an active purge claim.
  UPDATE user_deletions SET status = 'cancelled'
  WHERE user_id = 'a0000000-0000-0000-0000-00000000000c'
    AND status IN ('pending', 'failed') AND cardinality(completed_steps) = 0;
  GET DIAGNOSTICS cancelled = ROW_COUNT;
  ASSERT cancelled = 0, 'cancel must not win against a purge claim';

  UPDATE user_deletions SET legal_hold = true WHERE id = 'c0000000-0000-0000-0000-000000000001';
  BEGIN
    PERFORM streamfi_purge_user('c0000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'purge ignored the legal hold';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%legal hold%' THEN RAISE; END IF;
  END;
  UPDATE user_deletions SET legal_hold = false WHERE id = 'c0000000-0000-0000-0000-000000000001';
END $$;

CREATE TABLE test_unmapped_reference (owner UUID REFERENCES users(id));
DO $$
BEGIN
  BEGIN
    PERFORM streamfi_purge_user('c0000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'purge ignored an unmapped foreign key';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%no purge policy%' THEN RAISE; END IF;
  END;
  ASSERT (SELECT count(*) FROM stream_sessions WHERE user_id = 'a0000000-0000-0000-0000-00000000000c') = 1,
    'aborted purge changed nothing';
END $$;
DROP TABLE test_unmapped_reference;

DO $$ BEGIN PERFORM streamfi_purge_user('c0000000-0000-0000-0000-000000000001'); END $$;

DO $$
DECLARE
  u record;
BEGIN
  SELECT * INTO u FROM users WHERE id = 'a0000000-0000-0000-0000-00000000000c';
  ASSERT u.email IS NULL AND u.bio IS NULL AND u.avatar IS NULL, 'PII scrubbed';
  ASSERT u.username LIKE 'deleted_%' AND u.wallet LIKE 'purged_%', 'identifiers replaced';
  ASSERT u.sociallinks = '{}'::jsonb AND u.creator = '{}'::jsonb, 'JSONB reset to canonical empty values';
  ASSERT u.deleted_at IS NOT NULL, 'tombstone kept';
  ASSERT (SELECT status FROM user_deletions WHERE id = 'c0000000-0000-0000-0000-000000000001') = 'purged', 'deletion purged';
  ASSERT (SELECT count(*) FROM tip_transactions WHERE creator_id = u.id) = 1, 'tips preserved';
  ASSERT (SELECT count(*) FROM payouts WHERE user_id = u.id) = 1, 'payouts preserved';
  ASSERT (SELECT count(*) FROM stream_sessions WHERE user_id = u.id) = 0, 'sessions deleted';
  ASSERT (SELECT count(*) FROM stream_recordings WHERE user_id = u.id) = 0, 'recordings deleted';
  ASSERT (SELECT count(*) FROM user_follows WHERE followee_id = u.id) = 0, 'follows deleted';
  ASSERT (SELECT count(*) FROM stream_clips WHERE streamer_id = u.id) = 0, 'clips of the purged streamer deleted';
  ASSERT (SELECT referred_by FROM users WHERE id = 'a0000000-0000-0000-0000-00000000000e') IS NULL,
    'referral link to the purged user nullified';
  ASSERT (SELECT moderated_by FROM chat_messages WHERE content = 'elsewhere') IS NULL, 'moderator reference nullified';
  BEGIN
    PERFORM streamfi_purge_user('c0000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'purge ran twice';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%expected purging%' THEN RAISE; END IF;
  END;
END $$;

-- Freed identifiers can register again.
INSERT INTO users (wallet, username, email) VALUES ('GTESTCREATOR', 'test_creator', 'creator@test.invalid');

-- ── #1409 Mux drift findings ────────────────────────────────────────────────
INSERT INTO stream_recordings (id, user_id, mux_asset_id, playback_id, status) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000e', 'test-gone', 'pb', 'ready');

CREATE TEMP TABLE upsert_results (run_id uuid, inserted boolean, detection_count int);
CREATE FUNCTION pg_temp.upsert_finding(p_run uuid) RETURNS void LANGUAGE sql AS $f$
  WITH x AS (
    INSERT INTO mux_drift_findings (kind, mux_asset_id, row_table, row_id, previous_status, first_detected_run_id, last_detected_run_id)
    VALUES ('DB_ROW_WITHOUT_MUX_ASSET', 'test-gone', 'stream_recordings', 'e0000000-0000-0000-0000-000000000001', 'ready', p_run, p_run)
    ON CONFLICT (kind, mux_asset_id) WHERE status = 'open' DO UPDATE
      SET last_detected_run_id = EXCLUDED.last_detected_run_id, last_detected_at = now(),
          detection_count = mux_drift_findings.detection_count +
            CASE WHEN mux_drift_findings.last_detected_run_id = EXCLUDED.last_detected_run_id THEN 0 ELSE 1 END
    RETURNING (xmax = 0) AS inserted, detection_count
  )
  INSERT INTO upsert_results SELECT p_run, inserted, detection_count FROM x;
$f$;
DO $$
BEGIN
  PERFORM pg_temp.upsert_finding('d0000000-0000-0000-0000-000000000001');
  PERFORM pg_temp.upsert_finding('d0000000-0000-0000-0000-000000000001');
  PERFORM pg_temp.upsert_finding('d0000000-0000-0000-0000-000000000002');
  ASSERT (SELECT array_agg(inserted ORDER BY ctid) FROM upsert_results) = ARRAY[true, false, false],
    'first detection inserts, later detections update';
  ASSERT (SELECT count(*) FROM mux_drift_findings WHERE mux_asset_id = 'test-gone') = 1, 'one open finding per asset';
  ASSERT (SELECT detection_count FROM mux_drift_findings WHERE mux_asset_id = 'test-gone') = 2,
    'repeat upsert within a run does not double count';
END $$;

-- stream_clips accepts the 'unavailable' status used to hide dead clips.
INSERT INTO stream_clips (clipped_by, streamer_id, start_offset, duration, status)
VALUES ('a0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000e', 0, 10, 'unavailable');

-- ── #1405 corrections are applied and recorded atomically, exactly once ─────
INSERT INTO job_runs (job_name, status, started_at, duration_ms, run_id) VALUES
  ('tip-total-reconciliation', 'succeeded', now(), 0, 'f0000000-0000-0000-0000-000000000001');
DO $$
DECLARE
  n integer;
  v bigint;
BEGIN
  -- Same statement shape as recordTipTransactions in lib/stellar/tip-reconciliation.ts.
  FOR i IN 1..2 LOOP
    WITH ins AS (
      INSERT INTO tip_transactions (creator_id, amount_xlm, tx_hash)
      VALUES ('a0000000-0000-0000-0000-00000000000e', 1.5, 'test-missing')
      ON CONFLICT (tx_hash) WHERE tx_hash IS NOT NULL DO NOTHING
      RETURNING creator_id, tx_hash, amount_xlm
    )
    INSERT INTO tip_reconciliation_corrections (run_id, kind, user_id, tx_hash, amount_after, delta)
    SELECT 'f0000000-0000-0000-0000-000000000001'::uuid, 'TIP_INSERTED', creator_id, tx_hash, amount_xlm, amount_xlm
    FROM ins
    ON CONFLICT DO NOTHING;
  END LOOP;
  SELECT count(*) INTO n FROM tip_reconciliation_corrections WHERE tx_hash = 'test-missing';
  ASSERT n = 1, 'a retried insert records one correction';

  -- Same statement shape as reconcileUserTipTotals: the correction row exists
  -- only when the version-guarded update applied and the totals changed.
  SELECT tip_totals_version INTO v FROM users WHERE id = 'a0000000-0000-0000-0000-00000000000e';
  FOR i IN 1..2 LOOP
    WITH upd AS (
      UPDATE users SET total_tips_received = 1.5, total_tips_count = 1,
                       tip_totals_version = tip_totals_version + 1
      WHERE id = 'a0000000-0000-0000-0000-00000000000e' AND tip_totals_version = v
      RETURNING id
    ), correction AS (
      INSERT INTO tip_reconciliation_corrections
        (run_id, kind, user_id, amount_before, amount_after, delta, count_before, count_after)
      SELECT 'f0000000-0000-0000-0000-000000000001'::uuid, 'TOTALS_CORRECTED', id, 3::numeric, 1.5, 1.5 - 3, 2, 1
      FROM upd
      ON CONFLICT DO NOTHING
    )
    SELECT count(*) INTO n FROM upd;
  END LOOP;
  ASSERT n = 0, 'a stale version changes nothing';
  ASSERT (SELECT delta FROM tip_reconciliation_corrections WHERE kind = 'TOTALS_CORRECTED'
          AND user_id = 'a0000000-0000-0000-0000-00000000000e') = -1.5,
    'decrease recorded with its signed delta';

  BEGIN
    INSERT INTO tip_reconciliation_corrections (run_id, kind, user_id, delta)
    VALUES ('f0000000-0000-0000-0000-000000000001', 'SOMETHING_ELSE', 'a0000000-0000-0000-0000-00000000000e', 0);
    RAISE EXCEPTION 'unknown correction kind accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- An alert fingerprint is stored once and claimed for delivery once.
DO $$
DECLARE
  n integer;
BEGIN
  FOR i IN 1..2 LOOP
    INSERT INTO reconciliation_alerts (fingerprint, source, run_id, severity, signature, payload)
    VALUES ('test-fp', 'tip-total-reconciliation', 'f0000000-0000-0000-0000-000000000001', 'critical', 'sig', '{}')
    ON CONFLICT (fingerprint) DO UPDATE SET fingerprint = EXCLUDED.fingerprint;
  END LOOP;
  ASSERT (SELECT count(*) FROM reconciliation_alerts WHERE fingerprint = 'test-fp') = 1, 'one alert per fingerprint';
  WITH c AS (UPDATE reconciliation_alerts SET delivered_at = now() WHERE fingerprint = 'test-fp' AND delivered_at IS NULL RETURNING id)
  SELECT count(*) INTO n FROM c;
  ASSERT n = 1, 'first claim wins';
  WITH c AS (UPDATE reconciliation_alerts SET delivered_at = now() WHERE fingerprint = 'test-fp' AND delivered_at IS NULL RETURNING id)
  SELECT count(*) INTO n FROM c;
  ASSERT n = 0, 'second claim loses';
END $$;

ROLLBACK;
