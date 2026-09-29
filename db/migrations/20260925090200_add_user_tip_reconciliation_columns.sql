-- #1400: scheduled re-derivation of users.total_tips_received from the ledger.
--
-- tip_totals_version: bumped by every writer of the tip totals (manual refresh,
--   scheduled reconciliation, Stellar payment webhook). A reconciliation reads
--   the version before querying Horizon and only writes if it is unchanged, so
--   a slower run can never overwrite a newer total.
-- tips_reconciled_at: last successful ledger reconciliation; drives staleness
--   ordering (never reconciled first, then oldest).
-- tips_reconcile_attempted_at: last attempt, successful or not, so a user whose
--   reconciliation keeps failing backs off instead of blocking the queue.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tip_totals_version BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tips_reconciled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tips_reconcile_attempted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_tips_reconciled_at
  ON users (tips_reconciled_at ASC NULLS FIRST);
