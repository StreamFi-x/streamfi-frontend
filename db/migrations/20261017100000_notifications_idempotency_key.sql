-- Add idempotency_key to notifications table to support request-level dedup (Issue #783)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency_key
  ON notifications (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
