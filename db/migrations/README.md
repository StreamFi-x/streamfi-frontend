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
- **20260925_mux_webhook_idempotency.sql** – Adds `mux_webhook_events`, the persistent event-id store that makes every Mux webhook apply at most once (#1397). Run before deploying the webhook changes. See `docs/mux-webhook-idempotency.md`.
- **20260925_mux_live_state_reconciliation.sql** – Adds `users.live_state_changed_at` (maintained by a trigger), an index on `users.mux_stream_id`, and `scheduled_job_runs` for cron leases/health (#1399). See `docs/mux-live-state-reconciliation.md`.
- **20260925_custodial_key_kms.sql** – Adds `users.encrypted_stellar_key_legacy`, `users.custodial_key_migrated_at` and the `custodial_key_migration_events` audit table for the KMS migration (#1396). Run before deploying; then follow `docs/custodial-key-kms.md`.
- **20260925190000_chat_poll_indexes.sql** – Indexes for the chat poll path (#1410). `-- migrate:no-transaction` (`CREATE INDEX CONCURRENTLY`). Safe before or after deploying. See `docs/postgres-pooling-and-chat-load.md`.
- **20260925190100_retire_livepeer_columns.sql** – Archives Livepeer-era IDs into `legacy_livepeer_refs`, then drops the legacy columns and indexes (#1408). Run `scripts/audit-livepeer-legacy.ts` and deploy the matching application code before `db:migrate up` applies it. Tested by `db/tests/retire-livepeer-columns.test.sql`. See `docs/livepeer-mux-audit.md`.
