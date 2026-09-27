-- Notifications move from the users.notifications JSONB[] column to their own
-- table (issue #1414).
--
-- Why: the array grew without bound on every user row. Every read loaded and
-- de-TOASTed the whole array to show 50 items, every write rewrote the row
-- (users is also cached and hot), and the list could not be paginated in the
-- database. A table gives bounded, indexed, cursor-paginated reads
-- (docs/api/pagination.md).
--
-- The shape matches what app/api/routes-f/register/complete already inserts
-- (user_id, type, title, body, is_read, created_at). Before this migration no
-- SQL in the repo created the table, so that insert failed wherever it had not
-- been created by hand. If one was created by hand, CREATE is skipped and the
-- ADD COLUMN statements bring it to the expected shape.
--
-- Deploy order: docs/database/migrations-20260926.md. The users.notifications
-- column is left in place and is no longer written; drop it in a later
-- migration once the backfill (next migration) has been verified.

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Keyset pagination: WHERE user_id = $1 AND (created_at, id) < ($2, $3)
-- ORDER BY created_at DESC, id DESC. The table is new and empty, so a plain
-- (non-concurrent) build inside this migration's transaction is instant.
CREATE INDEX IF NOT EXISTS idx_notifications_user_keyset
  ON notifications (user_id, created_at DESC, id DESC);

-- Unread badge: SELECT count(*) ... WHERE user_id = $1 AND is_read = false.
-- Partial, so it only holds unread rows and stays small.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id) WHERE is_read = false;
