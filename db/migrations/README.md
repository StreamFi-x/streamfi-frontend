# Database migrations

Run migrations in order when deploying schema changes.

- **add-stream-recording.sql** – Adds optional stream recording: `users.enable_recording`, `stream_sessions.title`/`playback_id`, and `stream_recordings` table. Run this before using the Record Live Streams toggle and recordings APIs.
- **20260925_01_job_infrastructure.sql** – `job_leases` and `job_runs` for the scheduled jobs.
- **20260925_02_jsonb_contract_functions.sql** – JSONB contract check functions and `jsonb_quarantine` (#1407).
- **20260925_03_jsonb_contract_constraints.sql** – CHECK constraints for `users.sociallinks` / `creator` / `notifications`. Run last, after the JSONB audit reports no invalid rows; it refuses to run otherwise.
- **20260925_04_user_tombstones.sql** – `users.deleted_at`, `user_deletions`, financial FKs to `ON DELETE RESTRICT`, `streamfi_purge_user()` (#1406). Run with `psql -f` outside a transaction (`CREATE INDEX CONCURRENTLY`).
- **20260925_05_mux_reconciliation.sql** – `mux_drift_findings`, `stream_recordings.unavailable_at` (#1409).
- **20260925_06_tip_reconciliation_alerting.sql** – `tip_reconciliation_corrections`, `reconciliation_alerts`, `job_runs.alert_evaluated_at` (#1405).

Order and rollout steps for the 20260925 migrations: see `docs/data-integrity.md#deployment`. Database tests: `db/tests/data-integrity.test.sql`.
