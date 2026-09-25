-- migrate:no-transaction
--
-- Online steps for the data-integrity migrations (#1406, #1409). They run
-- outside a transaction, statement by statement, so they do not hold a
-- write-blocking lock while scanning:
--   * the partial index on users.deleted_at is built CONCURRENTLY;
--   * foreign keys re-created NOT VALID by 20260925110100_user_tombstones and
--     the widened stream_clips status check from
--     20260925110200_mux_asset_reconciliation are validated under
--     SHARE UPDATE EXCLUSIVE (reads and writes continue).
-- Every statement is idempotent.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_deleted_at
  ON users (deleted_at)
  WHERE deleted_at IS NOT NULL;

DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT c.conrelid::regclass AS tbl, c.conname
    FROM pg_constraint c
    WHERE NOT c.convalidated
      AND (
        (c.contype = 'f' AND c.confrelid = 'users'::regclass)
        OR c.conname = 'stream_clips_status_check'
      )
  LOOP
    EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', con.tbl, con.conname);
  END LOOP;
END $$;
