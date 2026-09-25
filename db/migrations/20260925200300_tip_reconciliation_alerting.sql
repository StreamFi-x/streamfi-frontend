-- Anomaly alerting for the tip reconciliation job (#1405).
--
-- The job that reconciles tip totals with the Stellar ledger
-- (lib/stellar/tip-reconciliation.ts, #1400) records every change it makes in
-- tip_reconciliation_corrections, in the same statement as the change. Run
-- metrics and the alert baseline are aggregated from that table joined to
-- job_runs, so the alerting layer can never disagree with what the job did.
-- Amounts are NUMERIC(20,7), matching users.total_tips_received and
-- tip_transactions.amount_xlm.
--
-- Idempotent.

-- Correlates a job_runs row with the records its run wrote, and marks runs
-- the alert evaluator has processed (a crashed evaluation leaves NULL and is
-- retried by the next invocation).
ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS run_id UUID;
ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS alert_evaluated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_job_runs_run_id ON job_runs (run_id);
CREATE INDEX IF NOT EXISTS idx_job_runs_unevaluated
  ON job_runs (job_name, started_at)
  WHERE alert_evaluated_at IS NULL;

CREATE TABLE IF NOT EXISTS tip_reconciliation_corrections (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID          NOT NULL,
  kind          TEXT          NOT NULL CHECK (kind IN ('TOTALS_CORRECTED', 'TIP_INSERTED')),
  user_id       UUID          NOT NULL,
  tx_hash       TEXT,
  amount_before NUMERIC(20,7),
  amount_after  NUMERIC(20,7),
  -- Signed change (after - before); a negative value means the ledger shows
  -- less than was recorded.
  delta         NUMERIC(20,7) NOT NULL,
  count_before  INTEGER,
  count_after   INTEGER,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tip_recon_corrections_run
  ON tip_reconciliation_corrections (run_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tip_recon_corrections_totals
  ON tip_reconciliation_corrections (run_id, user_id)
  WHERE kind = 'TOTALS_CORRECTED';
CREATE UNIQUE INDEX IF NOT EXISTS uq_tip_recon_corrections_tip
  ON tip_reconciliation_corrections (run_id, tx_hash)
  WHERE kind = 'TIP_INSERTED';

CREATE TABLE IF NOT EXISTS reconciliation_alerts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT        NOT NULL UNIQUE,
  source      TEXT        NOT NULL,
  run_id      UUID,
  severity    TEXT        NOT NULL CHECK (severity IN ('warning', 'critical')),
  signature   TEXT        NOT NULL,
  -- Outcome reported by sendOperationalAlert (lib/security/alerts.ts):
  -- sent | logged (log line only: no webhook configured or delivery failed)
  -- | deduplicated | suppressed (hourly budget); pending until delivery ran.
  delivery    TEXT        NOT NULL DEFAULT 'pending'
              CHECK (delivery IN ('pending', 'sent', 'logged', 'deduplicated', 'suppressed')),
  payload     JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_alerts_created
  ON reconciliation_alerts (created_at DESC);
