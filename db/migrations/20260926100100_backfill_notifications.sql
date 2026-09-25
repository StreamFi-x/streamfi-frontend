-- Copy notifications from the legacy users.notifications JSONB[] column into
-- the notifications table (issue #1414).
--
-- Idempotent: each row gets a stable id (the item's own uuid, or a hash of
-- user + position + content for legacy items without a valid one) and
-- conflicts are skipped. The item's own `read` flag is carried over.
--
-- Runs with `db:migrate up` before the deploy, which moves nearly everything.
-- The old code keeps appending to the array until the new build is live, so
-- run this same file once more right after the deploy to pick up that window
-- (docs/database/migrations-20260926.md). Re-running it is harmless.
--
-- Array items look like:
--   {"id": "<uuid>", "type": "follow", "title": "...", "text": "...",
--    "read": false, "created_at": "<ISO-8601>"}
--
-- Cost: one pass over users with non-empty arrays, inserting into the new
-- table only; it takes no locks that block the application.

INSERT INTO notifications (id, user_id, type, title, body, is_read, created_at)
SELECT
  CASE
    WHEN item.n->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (item.n->>'id')::uuid
    ELSE md5(u.id::text || ':' || item.ord::text || ':' || item.n::text)::uuid
  END,
  u.id,
  COALESCE(NULLIF(item.n->>'type', ''), 'system'),
  COALESCE(item.n->>'title', ''),
  item.n->>'text',
  COALESCE((item.n->>'read')::boolean, false),
  CASE
    WHEN item.n->>'created_at' ~ '^\d{4}-\d{2}-\d{2}T'
      THEN (item.n->>'created_at')::timestamptz
    ELSE COALESCE(u.created_at, now())
  END
FROM users u
CROSS JOIN LATERAL unnest(u.notifications) WITH ORDINALITY AS item(n, ord)
WHERE u.notifications IS NOT NULL
  AND cardinality(u.notifications) > 0
ON CONFLICT (id) DO NOTHING;
