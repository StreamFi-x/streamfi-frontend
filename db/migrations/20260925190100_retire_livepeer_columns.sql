-- Retire the columns and indexes left behind by the Livepeer -> Mux migration.
-- Issue #1408; audit and dispositions in docs/livepeer-mux-audit.md.
--
-- Before `npm run db:migrate -- up` applies this in production:
--   1. Run `npx tsx scripts/audit-livepeer-legacy.ts` and keep its output.
--   2. Deploy the application code from the same PR first. Nothing in it reads
--      or writes these columns; older deployments' /api/debug/fix-db did.
--
-- The runner wraps the file in one transaction (applying it by hand needs
-- `psql --single-transaction`), so it either completes or changes nothing:
--   * Copies every non-empty legacy value into legacy_livepeer_refs with the
--     Mux reference present at the time and a disposition (same rules as
--     classifyLegacyValue in lib/maintenance/livepeer-legacy.ts).
--   * Aborts if any non-empty legacy value is missing from the archive.
--   * Drops the legacy indexes and columns.
--
-- Livepeer IDs cannot be converted into Mux IDs, so nothing is backfilled into
-- mux_* columns and no existing Mux value is read-modified-written.
-- Safe to rerun: archiving is ON CONFLICT DO NOTHING and every DROP is
-- IF EXISTS. Safe on databases that never had these columns.


CREATE TABLE IF NOT EXISTS legacy_livepeer_refs (
  id            BIGSERIAL   PRIMARY KEY,
  source_table  TEXT        NOT NULL,
  source_id     UUID        NOT NULL,
  column_name   TEXT        NOT NULL,
  legacy_value  TEXT        NOT NULL,
  mux_reference TEXT,
  disposition   TEXT        NOT NULL
    CHECK (disposition IN ('migrated', 'unprovisioned', 'legacy_history')),
  archived_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_table, source_id, column_name)
);

DO $$
DECLARE
  spec RECORD;
  mux_expr TEXT;
  orphan_disposition TEXT;
  missing BIGINT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('users',           'livepeer_stream_id',  'mux_stream_id'),
      ('users',           'playback_id',         'mux_playback_id'),
      ('stream_sessions', 'livepeer_session_id', 'mux_session_id'),
      ('stream_sessions', 'livepeer_stream_id',  'mux_session_id')
    ) AS t(tbl, col, mux_col)
  LOOP
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = spec.tbl AND column_name = spec.col
    );

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = spec.tbl AND column_name = spec.mux_col
    ) THEN
      mux_expr := format('NULLIF(%I::text, %L)', spec.mux_col, '');
    ELSE
      mux_expr := 'NULL::text';
    END IF;

    orphan_disposition :=
      CASE spec.tbl WHEN 'users' THEN 'unprovisioned' ELSE 'legacy_history' END;

    EXECUTE format(
      $sql$
        INSERT INTO legacy_livepeer_refs
          (source_table, source_id, column_name, legacy_value, mux_reference, disposition)
        SELECT %L, id, %L, %I::text, %s,
               CASE WHEN %s IS NOT NULL THEN 'migrated' ELSE %L END
          FROM %I
         WHERE %I IS NOT NULL AND %I::text <> ''
        ON CONFLICT (source_table, source_id, column_name) DO NOTHING
      $sql$,
      spec.tbl, spec.col, spec.col, mux_expr, mux_expr, orphan_disposition,
      spec.tbl, spec.col, spec.col
    );

    EXECUTE format(
      $sql$
        SELECT COUNT(*) FROM %I src
         WHERE src.%I IS NOT NULL AND src.%I::text <> ''
           AND NOT EXISTS (
             SELECT 1 FROM legacy_livepeer_refs a
              WHERE a.source_table = %L AND a.column_name = %L
                AND a.source_id = src.id AND a.legacy_value = src.%I::text
           )
      $sql$,
      spec.tbl, spec.col, spec.col, spec.tbl, spec.col, spec.col
    ) INTO missing;

    IF missing > 0 THEN
      RAISE EXCEPTION '%.% has % value(s) not archived; aborting before any DROP',
        spec.tbl, spec.col, missing;
    END IF;
  END LOOP;
END $$;

DROP INDEX IF EXISTS idx_users_livepeer_stream_id;
DROP INDEX IF EXISTS idx_users_livepeer;
DROP INDEX IF EXISTS idx_users_playback_id;
DROP INDEX IF EXISTS idx_stream_sessions_livepeer_session;

ALTER TABLE users
  DROP COLUMN IF EXISTS livepeer_stream_id,
  DROP COLUMN IF EXISTS playback_id;

ALTER TABLE stream_sessions
  DROP COLUMN IF EXISTS livepeer_session_id,
  DROP COLUMN IF EXISTS livepeer_stream_id;

