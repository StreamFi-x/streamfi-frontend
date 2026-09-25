# Database migrations

Migrations are applied and tracked by `npm run db:migrate`. See
[docs/database-migrations.md](../../docs/database-migrations.md) for naming,
the `schema_migrations` table, baselining existing environments, deployment
and recovery.

- New files: `npm run db:migrate -- create <name>` creates
  `YYYYMMDDHHMMSS_<name>.sql`.
- Files listed in `legacy-manifest.json` predate the runner and are frozen.
  Do not edit them.
- **add-stream-recording.sql** – Adds optional stream recording: `users.enable_recording`, `stream_sessions.title`/`playback_id`, and `stream_recordings` table. Run this before using the Record Live Streams toggle and recordings APIs.
- **20260925100200_mux_webhook_idempotency.sql** – Adds `mux_webhook_events`, the persistent event-id store that makes every Mux webhook apply at most once (#1397). Run before deploying the webhook changes. See `docs/mux-webhook-idempotency.md`.
- **20260925100100_mux_live_state_reconciliation.sql** – Adds `users.live_state_changed_at` (maintained by a trigger), an index on `users.mux_stream_id`, and `scheduled_job_runs` for cron leases/health (#1399). See `docs/mux-live-state-reconciliation.md`.
- **20260925100000_custodial_key_kms.sql** – Adds `users.encrypted_stellar_key_legacy`, `users.custodial_key_migrated_at` and the `custodial_key_migration_events` audit table for the KMS migration (#1396). Run before deploying; then follow `docs/custodial-key-kms.md`.
- **20260925110000 … 20260925120100** – Data-integrity migrations (#1405, #1406, #1407, #1409): JSONB contract functions, user tombstones and the purge function, Mux asset drift findings, tip reconciliation corrections and alerts, the online index/validation steps, and the JSONB CHECK constraints. `20260925120000` refuses to run until the JSONB audit reports no invalid rows. See `docs/data-integrity.md#deployment`; database tests in `db/tests/data-integrity.test.sql`.
