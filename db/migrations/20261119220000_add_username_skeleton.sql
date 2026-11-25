-- Confusable-safe usernames: store the UTS #39 style skeleton of each username
-- so look-alike registrations (for example Cyrillic "a" vs Latin "a") can be
-- rejected by an indexed lookup.
--
-- Not unique on purpose: legacy rows may already collide, and the application
-- rejects new collisions. Existing ASCII usernames are their own skeleton.

ALTER TABLE users ADD COLUMN IF NOT EXISTS username_skeleton TEXT;

UPDATE users
SET username_skeleton = LOWER(username)
WHERE username_skeleton IS NULL
  AND username IS NOT NULL
  AND username ~ '^[ -~]*$';

CREATE INDEX IF NOT EXISTS idx_users_username_skeleton
  ON users (username_skeleton);
