-- Username change history, redirect windows, cooldown tracking, and
-- release/re-registration protection (#1730, #1734).

ALTER TABLE users
ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS username_history (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_username VARCHAR(255) NOT NULL,
  new_username      VARCHAR(255) NOT NULL,
  changed_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  redirect_until    TIMESTAMPTZ  NOT NULL DEFAULT (now() + INTERVAL '90 days'),
  hold_until        TIMESTAMPTZ  NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_username_history_previous_lower
  ON username_history (LOWER(previous_username), changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_username_history_user_changed
  ON username_history (user_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_username_history_hold_until
  ON username_history (LOWER(previous_username), hold_until DESC);
