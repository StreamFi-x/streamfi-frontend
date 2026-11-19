# Livepeer → Mux leftovers: audit and retirement

Issue #1408. **Production was not inspected.** No production credentials were
available for this work. Everything below comes from the code, `db/schema.sql`,
migration history and git history. The production numbers have to come from
the audit script, run by a maintainer.

## What the migration left behind

Mux replaced Livepeer in `ba0b382` (2026-02-17). That commit renamed the
columns in `schema.sql`'s `CREATE TABLE` statements but left the indexes on
the old names. It also left the old `/api/debug/fix-db` route in place, which
still created the Livepeer columns.

| Object                                                                                          | Where it came from                   | State in the repo before this PR                                                                          |
| ----------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `users.livepeer_stream_id`                                                                      | pre-Mux `schema.sql`, `debug/fix-db` | Indexed by `schema.sql` although no `CREATE TABLE` defined it, so `schema.sql` failed on a fresh database |
| `users.playback_id`                                                                             | same                                 | Same. This was the Livepeer playback ID; Mux uses `users.mux_playback_id`.                                |
| `stream_sessions.livepeer_session_id`                                                           | pre-Mux `schema.sql`                 | Indexed by `schema.sql`, never created by it                                                              |
| `stream_sessions.livepeer_stream_id`                                                            | `debug/fix-db` (`NOT NULL`)          | Made nullable by `debug/migrate-chat` and `scripts/fix-stream-sessions.ts` because it blocked Mux inserts |
| `idx_users_livepeer_stream_id`, `idx_users_playback_id`, `idx_stream_sessions_livepeer_session` | `schema.sql`                         | Still there                                                                                               |
| `idx_users_livepeer`                                                                            | `debug/fix-db`                       | Created at runtime by the debug route                                                                     |

Still live and **not** Livepeer: `stream_sessions.playback_id` (Mux playback
ID written by `streams/start` and both Mux webhooks), and
`stream_recordings.playback_id` with its index (Mux asset playback).

Two further `schema.sql` problems stopped it from bootstrapping at all: a
missing comma in `CREATE TABLE tags`, and the indexes above. Both are fixed.
It now runs cleanly on an empty Postgres 16. Verified: the old file fails at
`idx_users_livepeer_stream_id` with `column "livepeer_stream_id" does not
exist`. `chat_messages.id` is also declared `UUID` there, while the chat
route pages with `id < $before::int`, so production is almost certainly a
`SERIAL`. I left that alone: it is outside this issue, and checking it needs
production access.

## Code dependencies

Every reference found, and what happened to it:

| Reference                                                                 | Kind                                                                               | Action                                                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `app/api/debug/fix-db/route.ts`                                           | Unauthenticated route that (re)created the Livepeer columns and indexes            | Deleted. Kept alive, it would recreate the columns after the migration.                  |
| `app/api/debug/user-stream/route.ts`                                      | Unauthenticated route reading `livepeer_stream_id`, `playback_id`                  | Deleted                                                                                  |
| `app/api/debug/env/route.ts`                                              | Exposed the first 8 characters of `LIVEPEER_API_KEY`                               | Livepeer fields removed                                                                  |
| `lib/env.ts`                                                              | Required `LIVEPEER_API_KEY` (module imported nowhere)                              | Removed                                                                                  |
| `scripts/fix-stream-sessions.ts`                                          | Made `livepeer_stream_id` nullable                                                 | Deleted (superseded by the migration)                                                    |
| `scripts/migrate-to-mux.sql`                                              | Commented-out "backfill" copying Livepeer IDs into `mux_*` columns                 | Replaced with a warning. Running it would have written IDs Mux rejects.                  |
| `lib/livepeer/server.ts.backup`, `components/StreamTestComponent.tsx.bak` | Dead backups, not compiled                                                         | Deleted                                                                                  |
| `app/api/debug/migrate-chat/route.ts`                                     | Drops `NOT NULL` on `stream_sessions.livepeer_stream_id` only if the column exists | Kept. It is a no-op after the migration and protects databases that have not run it yet. |

No cron job (`vercel.json`), admin tool, analytics query or test reads the
legacy columns. `lib/maintenance/__tests__/livepeer-legacy.test.ts` enforces
that with a codebase scan, which also covers `LIVEPEER_API_KEY`.

## Classification and disposition

Livepeer stream and playback IDs belong to a different provider and cannot
be turned into Mux IDs. The "recoverable by backfill" category is therefore
empty by construction. No row is repaired by copying, and no Mux value is
written.

| Class          | Rule                                                | Disposition                                                                                                                                                                                                               |
| -------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| migrated       | legacy value present and the Mux column populated   | Archive the legacy value, drop the column                                                                                                                                                                                 |
| unprovisioned  | `users` row with a Livepeer value and no Mux stream | Archive. Nothing is hidden: the creator is offline, and `/api/streams/create` provisions a Mux stream the next time they go live. The profile page already works without a stream.                                        |
| legacy_history | `stream_sessions` row from the Livepeer era         | Archive, and keep the row (analytics and chat history hang off it). Its `playback_id` is a Livepeer ID, but no route plays sessions by that column; recordings come from `stream_recordings`, which requires a Mux asset. |
| clean          | legacy value null or empty                          | Nothing to do                                                                                                                                                                                                             |

No Livepeer-era video can be lost. `stream_recordings.mux_asset_id` is
`NOT NULL`, so no Livepeer VOD was ever stored in a playable form.

The rules are implemented once in TypeScript (`classifyLegacyValue`) and once
in SQL (the migration). `db/tests/retire-livepeer-columns.test.sql` checks
that they agree.

## Tooling and order of operations

1. **Audit (read-only):** `POSTGRES_URL=… npx tsx scripts/audit-livepeer-legacy.ts`.
   Prints only per-column row counts per class and the legacy indexes found.
   No IDs, usernames or wallets are printed. Save the output on the PR or in
   the deploy log.
2. **Deploy this PR's code.** Nothing in it touches the legacy columns, and
   the route that recreated them is gone.
3. **Migrate:** `npm run db:migrate -- up` applies
   `db/migrations/20260925190100_retire_livepeer_columns.sql` (see
   `docs/database-migrations.md`). In one transaction it copies every non-empty legacy value into
   `legacy_livepeer_refs` (source row, column, value, the Mux reference at
   the time, disposition). It aborts before any `DROP` if a value is missing
   from the archive, then drops the indexes and columns. It is idempotent,
   safe on databases that never had the columns, and never touches `mux_*`
   values. `DROP COLUMN` does not cascade, so a view or other dependency that
   nobody knew about stops the migration instead of disappearing.
4. **Audit again:** every column should be `absent`, with no legacy indexes,
   and `legacy_livepeer_refs` row count equal to the sum of
   migrated + unprovisioned + legacy_history from step 1.

Rollback: the values survive in `legacy_livepeer_refs`, keyed by
`(source_table, source_id, column_name)`. The columns can be re-added and
repopulated from it if something unexpected turns up.

## Verification done

On Postgres 16 in Docker, with a database shaped like pre-Mux production:

- `db/tests/retire-livepeer-columns.test.sql` passes. It covers all four
  classes, empty strings, Mux values unchanged, no rows deleted, chat history
  intact, idempotent rerun, the abort guard (`users.livepeer_stream_id has 1
value(s) not archived; aborting before any DROP`, columns left intact), and
  a database with no legacy columns.
- The audit script's logic (`auditLivepeerLegacy`, run with a `pg` adapter)
  reported migrated=4, unprovisioned=3, legacy_history=2 before the migration.
  Afterwards every column was absent, no legacy indexes remained, and the
  archive held 9 rows.
- `db/schema.sql` bootstraps an empty database.

Run the SQL test on any disposable database with:

```sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/retire-livepeer-columns.test.sql
```
