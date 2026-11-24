-- Transactional email dead-letter persistence (#1748).
--
-- Records transactional emails that failed delivery even after retry attempts,
-- providing operational visibility and a queryable backlog for admin review
-- or backfilling.

CREATE TABLE IF NOT EXISTS transactional_email_dead_letters (
  id               BIGSERIAL PRIMARY KEY,
  email_type       TEXT NOT NULL,
  recipient_email  TEXT NOT NULL,
  subject          TEXT NOT NULL,
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts         INTEGER NOT NULL,
  last_error       TEXT NOT NULL,
  dead_lettered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_dead_letters_unresolved
  ON transactional_email_dead_letters (dead_lettered_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_dead_letters_recipient
  ON transactional_email_dead_letters (recipient_email);

-- Rollback (manual):
--   DROP INDEX IF EXISTS idx_email_dead_letters_recipient;
--   DROP INDEX IF EXISTS idx_email_dead_letters_unresolved;
--   DROP TABLE IF EXISTS transactional_email_dead_letters;
