-- #1397 Persistent Mux webhook replay protection.
--
-- One row per Mux event id that reached a side-effecting handler. The
-- primary key is the idempotency guarantee: the row is inserted inside the
-- same transaction as the event's side effects, so two concurrent deliveries
-- of the same event serialize on the unique index and only one can commit.
--
--   processed  side effects committed; later deliveries are acknowledged
--              without re-running them
--   failed     processing rolled back; the next delivery retries it
--
-- Retention: processed rows are purged after MUX_WEBHOOK_EVENT_RETENTION_DAYS
-- (default 7), failed rows after 30 days, by
-- /api/routes-f/cron-purge-mux-webhook-events. See docs/mux-webhook-idempotency.md.

CREATE TABLE IF NOT EXISTS mux_webhook_events (
  event_id         TEXT PRIMARY KEY,
  event_type       TEXT NOT NULL,
  object_id        TEXT,
  endpoint         TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('processed', 'failed')),
  attempts         INTEGER NOT NULL DEFAULT 1,
  last_error       TEXT,
  event_created_at TIMESTAMPTZ,
  received_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at     TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mux_webhook_events_status_received
  ON mux_webhook_events (status, received_at);
