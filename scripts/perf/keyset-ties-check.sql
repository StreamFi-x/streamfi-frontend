-- Correctness check for chat pagination under timestamp ties (hot session sfperf.sid(1):
-- groups of 4 rows share created_at, plus one 300-row tie).
-- Pages through the whole session with
--   (a) the NEW (created_at, id) keyset cursor, LIMIT 201 (200 shown + 1 has-more probe)
--   (b) a created_at-only cursor ("created_at < last.created_at"), LIMIT 200
-- and reports rows returned, distinct rows, and rows never returned.
\set ON_ERROR_STOP on
DO $$
DECLARE
  sess uuid := sfperf.sid(1);
  total bigint;
  cur_ts timestamptz; cur_id uuid;
  pages int; got bigint; n int;
  r record;
BEGIN
  SELECT count(*) INTO total FROM chat_messages WHERE stream_session_id = sess AND is_deleted = false;

  -- (a) tuple keyset
  CREATE TEMP TABLE seen_a (id uuid) ON COMMIT DROP;
  cur_ts := 'infinity'; cur_id := 'ffffffff-ffff-ffff-ffff-ffffffffffff'; pages := 0;
  LOOP
    n := 0;
    FOR r IN
      SELECT cm.id, cm.created_at FROM chat_messages cm
      WHERE cm.stream_session_id = sess AND cm.is_deleted = false
        AND (cm.created_at, cm.id) < (cur_ts, cur_id)
      ORDER BY cm.created_at DESC, cm.id DESC LIMIT 201
    LOOP
      n := n + 1;
      EXIT WHEN n = 201;                -- probe row: not shown, next page starts after row 200
      INSERT INTO seen_a VALUES (r.id);
      cur_ts := r.created_at; cur_id := r.id;
    END LOOP;
    pages := pages + 1;
    EXIT WHEN n < 201;
  END LOOP;
  SELECT count(*) INTO got FROM seen_a;
  RAISE NOTICE 'tuple keyset:      total=% pages=% returned=% distinct=% missing=%',
    total, pages, got, (SELECT count(DISTINCT id) FROM seen_a),
    total - (SELECT count(DISTINCT id) FROM seen_a);

  -- (b) created_at-only cursor
  CREATE TEMP TABLE seen_b (id uuid) ON COMMIT DROP;
  cur_ts := 'infinity'; pages := 0;
  LOOP
    n := 0;
    FOR r IN
      SELECT cm.id, cm.created_at FROM chat_messages cm
      WHERE cm.stream_session_id = sess AND cm.is_deleted = false
        AND cm.created_at < cur_ts
      ORDER BY cm.created_at DESC LIMIT 200
    LOOP
      n := n + 1;
      INSERT INTO seen_b VALUES (r.id);
      cur_ts := r.created_at;
    END LOOP;
    pages := pages + 1;
    EXIT WHEN n < 200;
  END LOOP;
  SELECT count(*) INTO got FROM seen_b;
  RAISE NOTICE 'created_at cursor: total=% pages=% returned=% distinct=% missing=%',
    total, pages, got, (SELECT count(DISTINCT id) FROM seen_b),
    total - (SELECT count(DISTINCT id) FROM seen_b);
END $$;
