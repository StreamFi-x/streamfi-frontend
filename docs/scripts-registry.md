# Operational and data-migration scripts

`scripts/` mixes one-off data migrations, cron jobs, and setup/audit tools.
This is distinct from the versioned **schema** migrations in `db/migrations/`
tracked by `schema_migrations` (see
[docs/database-migrations.md](./database-migrations.md)) -- these scripts
change or inspect _data_, run manually or via a scheduler, and some of them
predate any tracking at all.

Scripts that are not safe to run twice, or not safe to run before another
script, now record a row in `script_runs` (via `lib/scripts/registry.ts`)
the first time they run against a database, and refuse to run again unless
you pass `--force`. This does not apply to every script here -- only the
ones explicitly listed below as unsafe. A script with no idempotency note
below has not been reviewed; treat it as unsafe until it is.

## Execution order

Scripts with a real ordering dependency, oldest first:

1. `setup-db.js` -- creates the `subscribers` table. Safe to run any time;
   everything else here is independent of it.
2. `updateUserSchema.ts` -- drops and recreates `users`. **Must run before**
   `migrate-tip-counter.mjs` (which only adds columns to an existing `users`
   table) on any database that still needs the reset. On a database that
   already has a correct `users` table, never run this.
3. `migrate-tip-counter.mjs` -- adds tip-counter columns to `users`.
4. `migrate-custodial-keys-to-kms.ts` (#1396) -- re-encrypts custodial key
   envelopes. Independent of the above; has its own `--dry-run` / `--verify`
   / `--migrate` / `--purge-legacy` lifecycle, documented in
   `docs/custodial-key-kms.md`.
5. `migrate-admin-allowlist.ts` -- grants `super_admin` from env-configured
   allowlists. Run any time after `users` exists.
6. `rotate-stellar-encryption-key.ts` -- rotates the Stellar/TOTP encryption
   keyring. Independent; has its own `--dry-run` flag.
7. `audit-livepeer-legacy.ts` (#1408) -- read-only. Run before and after
   `db/migrations/20260925190100_retire_livepeer_columns.sql` to confirm the
   migration's effect; never writes.
8. `backfill-analytics.ts` -- backfills analytics tables. Safe to run
   repeatedly; each backfill tracks its own watermark (see
   `getBackfillStatus`).

`cron-cleanup-sessions.ts` and the `load-test/` and `perf/` scripts are
operational/diagnostic, not migrations, and have no ordering dependency on
anything above.

## Idempotency guarantees

| Script                             | Safe to re-run?                 | Guard                                              |
| ---------------------------------- | ------------------------------- | -------------------------------------------------- |
| `setup-db.js`                      | Yes                             | `CREATE TABLE IF NOT EXISTS`                       |
| `updateUserSchema.ts`              | **No** -- destroys `users` data | `script_runs` via `runOnce`; `--force` to override |
| `migrate-tip-counter.mjs`          | Yes                             | `ADD COLUMN IF NOT EXISTS`                         |
| `migrate-custodial-keys-to-kms.ts` | Yes                             | per-row envelope state check; own `--verify`       |
| `migrate-admin-allowlist.ts`       | Yes                             | `UPDATE ... WHERE` on stable identity columns      |
| `rotate-stellar-encryption-key.ts` | Yes                             | keyring-version check per row; own `--dry-run`     |
| `audit-livepeer-legacy.ts`         | Yes                             | read-only                                          |
| `backfill-analytics.ts`            | Yes                             | per-job watermark                                  |
| `cron-cleanup-sessions.ts`         | Yes                             | deletes only rows already past expiry              |

Only `updateUserSchema.ts` is in the "no" column today. Adding a new script
to `scripts/` that mutates data unconditionally (no `IF NOT EXISTS` / `WHERE`
guard) requires wrapping its mutation in `runOnce()` from
`lib/scripts/registry.ts` and adding a row to both tables above.

## Checking what has run

```sql
SELECT * FROM script_runs ORDER BY started_at;
```

A `running` row with no `finished_at` means a previous invocation crashed
mid-run; inspect the database by hand before resolving it (re-run with
`--force`, or delete the row once you've confirmed it's safe to retry).
