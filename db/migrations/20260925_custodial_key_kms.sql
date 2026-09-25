-- #1396 Move custodial key encryption from a static key to KMS envelopes.
--
-- encrypted_stellar_key_legacy  the pre-migration static-key ciphertext,
--                               kept only as a rollback path until the
--                               envelope has been re-verified; nulled by
--                               `--purge-legacy` before STELLAR_ENCRYPTION_KEY
--                               is retired.
-- custodial_key_migrated_at     when the row was re-encrypted.
--
-- The migration's checkpoint is the data itself: a row is migrated once its
-- encrypted_stellar_key carries the explicit `ckv2:` version prefix, so an
-- interrupted run resumes by re-selecting the rows that still lack it.
-- See docs/custodial-key-kms.md for the rollout procedure.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS encrypted_stellar_key_legacy TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS custodial_key_migrated_at TIMESTAMPTZ;

-- Audit trail of every migration decision. Never contains key material.
CREATE TABLE IF NOT EXISTS custodial_key_migration_events (
  id          BIGSERIAL PRIMARY KEY,
  run_id      TEXT NOT NULL,
  user_id     UUID,
  mode        TEXT NOT NULL CHECK (mode IN ('migrate', 'dry_run', 'verify', 'purge_legacy')),
  outcome     TEXT NOT NULL CHECK (outcome IN ('succeeded', 'failed', 'skipped')),
  reason      TEXT NOT NULL,
  kms_key_id  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custodial_key_migration_events_run
  ON custodial_key_migration_events (run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_custodial_key_migration_events_user
  ON custodial_key_migration_events (user_id, created_at);
