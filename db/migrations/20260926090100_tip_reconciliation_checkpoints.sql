-- Resumable tip reconciliation (#1418). See docs/background-jobs.md and
-- lib/stellar/tip-reconciliation.ts.
--
-- One row per creator: how far the walk over the account's Stellar payment
-- history (oldest first) has got, and the running totals of every tip up to
-- that point. The ledger is append-only, so the totals up to `cursor` never
-- change: a walk interrupted by a Horizon outage resumes from `cursor`
-- instead of starting over, and once the walk has reached the end, later
-- reconciliations only read payments newer than `cursor`.
--
-- Each page advances the row with a compare-and-set on `cursor`, so two
-- workers can never add the same page twice. users.total_tips_* is written
-- from this row only when the walk has reached the end of the history.
CREATE TABLE IF NOT EXISTS tip_reconciliation_checkpoints (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_key         TEXT NOT NULL,
  -- Version of the tip definition the totals were computed with; a change
  -- restarts the walk from the beginning.
  definition_version INTEGER NOT NULL,
  -- Horizon paging token of the last processed payment; NULL = not started.
  cursor             TEXT,
  total_stroops      NUMERIC(30, 0) NOT NULL DEFAULT 0,
  tip_count          INTEGER NOT NULL DEFAULT 0,
  last_tip_at        TIMESTAMPTZ,
  pages              INTEGER NOT NULL DEFAULT 0,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Set when the walk last reached the end of the history.
  caught_up_at       TIMESTAMPTZ
);

-- Rollback (manual): DROP TABLE IF EXISTS tip_reconciliation_checkpoints;
