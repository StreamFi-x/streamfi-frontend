-- Tip reconciliation corrections and anomaly alerts (#1405).
--
-- tip_reconciliation_corrections is the single source of truth for what a
-- reconciliation run changed or flagged. Run metrics and the alert baseline
-- are aggregated from this table, so the alerting layer can never disagree
-- with what the reconciliation job actually did. Amounts are NUMERIC(20,7),
-- matching tip_transactions.amount_xlm.
--
-- Idempotent: safe to run more than once.

-- Set once the alert evaluator has processed a run. Runs left NULL (evaluator
-- crashed or could not run) are picked up again by the next invocation.
ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS alert_evaluated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_job_runs_unevaluated
  ON job_runs (job_name, started_at)
  WHERE alert_evaluated_at IS NULL;

CREATE TABLE IF NOT EXISTS tip_reconciliation_corrections (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id             UUID          NOT NULL REFERENCES job_runs(id) ON DELETE RESTRICT,
  kind               TEXT          NOT NULL
                     CHECK (kind IN ('MISSING_TIP_INSERTED', 'AMOUNT_CORRECTED', 'NOT_ON_LEDGER', 'CREATOR_MISMATCH')),
  applied            BOOLEAN       NOT NULL,
  tip_transaction_id UUID,
  tx_hash            TEXT          NOT NULL,
  creator_id         UUID          NOT NULL,
  amount_before      NUMERIC(20,7),
  amount_after       NUMERIC(20,7),
  delta_abs          NUMERIC(20,7) NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (run_id, kind, tx_hash)
);

CREATE INDEX IF NOT EXISTS idx_tip_recon_corrections_run
  ON tip_reconciliation_corrections (run_id);

CREATE TABLE IF NOT EXISTS reconciliation_alerts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint   TEXT        NOT NULL UNIQUE,
  source        TEXT        NOT NULL,
  run_id        UUID        REFERENCES job_runs(id) ON DELETE RESTRICT,
  severity      TEXT        NOT NULL CHECK (severity IN ('warning', 'critical')),
  signature     TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'sending', 'delivered', 'failed', 'suppressed')),
  payload       JSONB       NOT NULL,
  attempts      INTEGER     NOT NULL DEFAULT 0,
  last_error    TEXT,
  claimed_until TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_alerts_status
  ON reconciliation_alerts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reconciliation_alerts_signature
  ON reconciliation_alerts (source, signature, delivered_at DESC);
