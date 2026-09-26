-- Copy notifications from the legacy users.notifications JSONB[] column into
-- the notifications table (issue #1414).
--
-- Idempotent: each row gets a stable id (the item's own uuid, or a hash of
-- user + position + content for legacy items without a valid one) and
-- conflicts are skipped.
--
-- Element shapes follow lib/db/jsonb-contracts.ts (readNotifications):
--   current  {id, type, title, text, read, created_at}: copied as is.
--   legacy   {title, text, read?} from the first notifications endpoint: type
--            'legacy', read = true unless it says otherwise (the old unread
--            counter never counted them), created_at = the user's creation
--            time (the table needs one for ordering; they predate everything
--            else, so they sort oldest).
--   anything without string title and text is skipped, as the reader skips it.
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
--
-- Skipped where users.notifications does not exist (a database created after
-- the column was retired, or the minimal schema used by the database tests).

DO $backfill$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'users'::regclass AND attname = 'notifications' AND NOT attisdropped
  ) THEN
    RETURN;
  END IF;

  EXECUTE $sql$
    INSERT INTO notifications (id, user_id, type, title, body, is_read, created_at)
    SELECT
      CASE
        WHEN item.n->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (item.n->>'id')::uuid
        ELSE md5(u.id::text || ':' || item.ord::text || ':' || item.n::text)::uuid
      END,
      u.id,
      COALESCE(NULLIF(item.n->>'type', ''), 'legacy'),
      item.n->>'title',
      item.n->>'text',
      CASE
        WHEN jsonb_typeof(item.n->'read') = 'boolean' THEN (item.n->>'read')::boolean
        ELSE true
      END,
      CASE
        WHEN item.n->>'created_at' ~ '^\d{4}-\d{2}-\d{2}T'
          THEN (item.n->>'created_at')::timestamptz
        ELSE COALESCE(u.created_at, now())
      END
    FROM users u
    CROSS JOIN LATERAL unnest(u.notifications) WITH ORDINALITY AS item(n, ord)
    WHERE u.notifications IS NOT NULL
      AND cardinality(u.notifications) > 0
      AND jsonb_typeof(item.n) = 'object'
      AND jsonb_typeof(item.n->'title') = 'string'
      AND jsonb_typeof(item.n->'text') = 'string'
    ON CONFLICT (id) DO NOTHING
  $sql$;
END
$backfill$;
