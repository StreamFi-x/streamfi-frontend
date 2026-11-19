-- #1401: platform-wide Idempotency-Key store for payment-adjacent routes.
--
-- A key is scoped by (user_id, scope, idempotency_key): the same client key
-- can never collide across users or across operation types. The unique
-- constraint is what makes the claim atomic; exactly one request inserts the
-- row and wins the right to run the operation.
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  scope               TEXT NOT NULL,
  idempotency_key     TEXT NOT NULL,
  request_fingerprint CHAR(64) NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('processing', 'completed')),
  -- Lease for the in-flight owner. A processing row whose lease has lapsed
  -- belongs to a request that crashed and may be taken over by a retry.
  locked_until        TIMESTAMPTZ NOT NULL,
  attempts            INTEGER NOT NULL DEFAULT 1,
  response_status     INTEGER,
  response_body       JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ NOT NULL,
  CONSTRAINT idempotency_keys_scope_unique UNIQUE (user_id, scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at
  ON idempotency_keys (expires_at);

-- Payout rows remember the idempotency record that created them. A retry that
-- takes over a crashed request re-runs the insert, hits this unique index and
-- recovers the original payout instead of creating a second one.
ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS idempotency_ref UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_idempotency_ref
  ON payouts (idempotency_ref)
  WHERE idempotency_ref IS NOT NULL;
