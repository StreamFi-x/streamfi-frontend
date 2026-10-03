# Database migrations

Schema changes are applied by a tracked runner (`scripts/migrate.ts`, logic in
`lib/migrations/`). It records every migration in `schema_migrations`.

## Commands

```bash
npm run db:migrate -- status        # state of every migration
npm run db:migrate -- verify        # exit 1 on drift (edited/missing files, failed runs)
npm run db:migrate -- up --dry-run  # list what would be applied
npm run db:migrate -- up            # apply pending migrations
npm run db:migrate -- create add_payout_index   # new db/migrations/YYYYMMDDHHMMSS_add_payout_index.sql
npm run db:migrate -- baseline --all-legacy [--dry-run]
npm run db:migrate -- resolve <id> --applied | --rolled-back
```

Connection: `MIGRATION_DATABASE_URL`, else `POSTGRES_URL_NON_POOLING`, else
`DATABASE_URL`. It must be a **direct** connection. The runner refuses Neon
`-pooler.` URLs because the migration lock is a session-level advisory lock.

## Naming and identity

- New migrations are named `YYYYMMDDHHMMSS_snake_case.sql` (UTC). The file stem
  is the migration's permanent id; never rename or edit a migration once it
  has been applied anywhere.
- The 16 files that predate the runner keep their original names. They are
  listed in `db/migrations/legacy-manifest.json` in the order they were added
  to git, each with a frozen checksum. A test fails if any of them is edited.
- Apply order: legacy files in manifest order, then versioned files by version.
- Files that are neither legacy nor correctly named are rejected.

## Guarantees

- **Tracking:** `schema_migrations` stores version, file, kind, SHA-256
  checksum (of LF-normalised content), status, duration and who applied it.
- **Checksums:** if an applied file's contents change, `up` and `verify` fail
  loudly. They never treat it as the same migration.
- **Atomicity:** each migration runs in its own transaction, together with its
  `schema_migrations` row. On failure it rolls back and nothing is recorded.
  Transaction-control statements inside a migration are rejected.
- **Non-transactional migrations** (e.g. `CREATE INDEX CONCURRENTLY`) start
  with `-- migrate:no-transaction`. They run statement by statement. The row is
  written as `running` first and marked `failed` on error. Either state blocks
  further runs until an operator inspects the database and runs `resolve`.
- **Concurrency:** runners take `pg_advisory_lock` on a fixed key, so two
  deploys, containers or machines cannot apply migrations at the same time.
  A runner waits up to 2 minutes for the lock, then gives up.
- **Out of order:** a pending migration that sorts before an applied one is
  refused unless `--allow-out-of-order` is passed.

## Baselining an existing environment (run once per environment)

Existing databases (production, staging) already contain the legacy
migrations, applied by hand with `psql`. The repository cannot prove which
ones, so the runner never assumes:

1. `up` refuses to run on a database that has a `users` table but an empty
   `schema_migrations`.
2. An authorised operator runs `npm run db:migrate -- baseline --all-legacy --dry-run`.
   Each legacy migration has a schema probe (for example, "does
   `user_two_factor` exist"). The dry run reports any migration whose probe
   fails.
3. If every probe passes, run the same command without `--dry-run`. Rows are
   written with status `baselined`, all in one transaction, and no SQL is
   executed. Re-running it is a no-op.
4. If some probes fail, that environment is missing those migrations. Baseline
   only the ones it has (`--only a,b` or `--through <id>`), then let `up` apply
   the rest. Use `--force` only after checking by hand.
5. Run `up` to apply the versioned migrations.

History cannot be replayed from scratch. Applying the legacy files in order on
an empty database fails at `add-stream-privacy-and-subs` because
`20260327_routes_f_creator_finance_and_badges` already created `subscriptions`
with a different shape. That is why environments are baselined, not rebuilt.

## Deployment

Vercel deploys on merge and does not run migrations. Apply migrations
**before** deploying code that depends on them:

```bash
MIGRATION_DATABASE_URL=<direct url> npm run db:migrate -- verify
MIGRATION_DATABASE_URL=<direct url> npm run db:migrate -- up
```

## Recovering from a failed migration

- A transactional failure leaves no trace. Fix the file (it was never
  recorded) and run `up` again.
- A `failed` or `running` no-transaction migration: inspect the database, then
  do one of the following.
  - Finish or undo the partial work by hand and run `resolve <id> --applied`.
  - Undo it, fix the file, run `resolve <id> --rolled-back`, then run `up`.

## Drift

`verify` detects edited, missing and failed migrations. It cannot detect
manual schema changes made outside the runner; make every change through a
migration.

## Tests

`__tests__/lib/migrations/runner.db.test.ts` runs against a real PostgreSQL
when `TEST_DATABASE_URL` is set; CI provides one. To run it locally:

```bash
docker run -d --name streamfi-pg -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:16-alpine
TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/postgres npx jest __tests__/lib
```
