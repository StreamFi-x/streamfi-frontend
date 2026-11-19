# Deploy runbook: notifications table, hot-path indexes, read replicas

This change ships four migrations for the tracked runner
(`docs/database-migrations.md`) plus application code. Steps are in order.
Each one is safe to re-run.

| #   | Step                                                                                        | When                           | Locks / risk                                      |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------- |
| 1   | `MIGRATION_DATABASE_URL=<direct url> npm run db:migrate -- verify`                          | Before anything                | Read-only                                         |
| 2   | `MIGRATION_DATABASE_URL=<direct url> npm run db:migrate -- up`                              | Before deploying, off-peak     | Applies four migrations, in order (details below) |
| 3   | Check for invalid indexes (query below)                                                     | After step 2                   | Read-only                                         |
| 4   | Deploy the application                                                                      | —                              | —                                                 |
| 5   | `psql "$MIGRATION_DATABASE_URL" -f db/migrations/20260926100100_backfill_notifications.sql` | Right after the deploy is live | Inserts into `notifications` only. Idempotent.    |
| 6   | Verify (below)                                                                              | After step 5                   | Read-only                                         |
| 7   | Optional: provision the read replica and set `POSTGRES_REPLICA_URL`                         | Any time after step 4          | `docs/database/read-replicas.md`                  |

The four migrations applied in step 2:

- **`20260926100000_create_notifications_table`** creates a new, empty table
  in a transaction.
- **`20260926100100_backfill_notifications`** runs in a transaction.
  - What it does: copies every readable item of `users.notifications` into
    the table. Shapes follow `lib/db/jsonb-contracts.ts`: legacy
    `{title, text}` items import as type `legacy` and read (as
    `readNotifications` shows them), and malformed items are skipped.
  - Locks: it only inserts into the new table, so it takes no lock that
    blocks the application.
  - Id mapping: each row keeps the item's own uuid, or gets a stable hash if
    the item has none. `ON CONFLICT DO NOTHING` makes it re-runnable.
- **`20260926100200_hot_path_indexes`** runs with `-- migrate:no-transaction`.
  - Builds use `CREATE`/`DROP INDEX CONCURRENTLY`, so there is no write
    lock, but each build scans its table.
  - It then runs `ANALYZE users`.
  - Sizes are in `docs/database/query-performance.md`.
- **`20260926100300_purge_policies_notifications_recovery`** runs in a
  transaction.
  - It re-creates `streamfi_purge_user` (#1406), adding `delete` policies for
    `notifications.user_id` and for the account-recovery tables from #1446.
  - Without it, every user purge aborts on a foreign key with no policy. The
    recovery tables already break purges on `dev` today. Reproduced against a
    database with all migrations applied; with this migration the purge
    deletes the user's notification rows and completes.

Why this order:

- **The table must exist before the deploy.** The new code reads and writes
  notifications there.
- **The indexes should exist before the deploy.** The new list queries work
  without them, only slower. The old code works unchanged with them, because
  every dropped index has its replacement created first.
- **The backfill runs twice.** The old code keeps appending to
  `users.notifications` until the new build is live. The copy in step 2
  moves almost everything. Step 5 re-runs the same file to pick up what was
  written during the deploy. Those rows are new since step 2, so a user
  cannot already have marked them read in the new UI.

If the `notifications` table was created by hand earlier (for
`routes-f/register/complete`), the first migration only adds missing columns
and indexes. Confirm its primary key is a `uuid` named `id` before step 2.

## Checks

```sql
-- 3. Invalid indexes left by an interrupted CONCURRENTLY build (expect none).
--    If any: drop it, `npm run db:migrate -- resolve 20260926100200_hot_path_indexes --rolled-back`, re-run `up`.
SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE NOT i.indisvalid;

-- 6a. Every readable legacy array item has a row (expect 0). Uses the backfill's
--     id mapping and filter; elements without string title/text are skipped,
--     as lib/db/jsonb-contracts.ts readNotifications skips them.
SELECT count(*) AS missing
FROM users u
CROSS JOIN LATERAL unnest(u.notifications) WITH ORDINALITY AS item(n, ord)
WHERE jsonb_typeof(item.n->'title') = 'string'
  AND jsonb_typeof(item.n->'text') = 'string'
  AND NOT EXISTS (
  SELECT 1 FROM notifications x
  WHERE x.id = CASE
    WHEN item.n->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (item.n->>'id')::uuid
    ELSE md5(u.id::text || ':' || item.ord::text || ':' || item.n::text)::uuid
  END
);

-- 6b. New indexes in use (run again a day later; idx_scan should be > 0)
SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes
WHERE indexrelname IN ('idx_users_username_lower', 'idx_users_wallet_lower',
  'idx_stream_clips_ready_keyset', 'idx_stream_recordings_user_keyset',
  'idx_stream_whitelist_streamer_keyset', 'idx_notifications_user_keyset');

-- 6c. Paginated lists skip rows with a NULL created_at (expect 0 each)
SELECT
  (SELECT count(*) FROM chat_messages WHERE created_at IS NULL)     AS chat,
  (SELECT count(*) FROM stream_clips WHERE created_at IS NULL)      AS clips,
  (SELECT count(*) FROM stream_recordings WHERE created_at IS NULL) AS recordings,
  (SELECT count(*) FROM stream_whitelist WHERE created_at IS NULL)  AS whitelist;
```

After deploy, also check:

- `/api/category` responses carry `x-vercel-cache: HIT` and
  `Vercel-Cache-Tag`-based purges work (`docs/caching-policy.md`, "Reference
  data at the edge").
- The notification bell shows the same items as before.

## Rollback

- **Application:** redeploy the previous build. It never used the
  `notifications` table and ignores it. Notifications written by the new
  code are not in the legacy array. To copy them back, set `:deployed_at` to
  when step 4 went live. Only rows written after that are copied: backfilled
  rows are already in the array, and items without a uuid got generated ids
  that the `NOT EXISTS` check cannot match.
  ```sql
  \set deployed_at '2026-09-26 18:00:00+00'
  UPDATE users u SET notifications = COALESCE(u.notifications, ARRAY[]::jsonb[]) || ARRAY(
    SELECT jsonb_build_object('id', n.id, 'type', n.type, 'title', n.title, 'text', n.body,
                              'read', n.is_read, 'created_at', n.created_at)
    FROM notifications n
    WHERE n.user_id = u.id
      AND n.created_at >= :'deployed_at'::timestamptz
      AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(u.notifications, ARRAY[]::jsonb[])) x(j)
                      WHERE x.j->>'id' = n.id::text)
    ORDER BY n.created_at)
  WHERE EXISTS (SELECT 1 FROM notifications n
                WHERE n.user_id = u.id AND n.created_at >= :'deployed_at'::timestamptz);
  ```
- **Indexes:** the old code runs fine with the new indexes. To restore a
  dropped one, create it again `CONCURRENTLY` from its definition in
  `db/schema.sql` or the legacy migrations, through a new migration.
- **Replica:** unset `POSTGRES_REPLICA_URL` and redeploy. Everything returns to
  the primary.

## API changes for other clients

The chat, clips, recordings, whitelist and notifications response shapes
changed (`docs/api/pagination.md` → Migration notes). All in-repo clients are
updated. Any external consumer must switch to `{ items, nextCursor, hasMore }`.
