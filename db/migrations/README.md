# Database migrations

Migrations are applied and tracked by `npm run db:migrate`. See
[docs/database-migrations.md](../../docs/database-migrations.md) for naming,
the `schema_migrations` table, baselining existing environments, deployment
and recovery.

## Canonical Schema Bootstrap

For bootstrapping fresh environments (development, staging, CI, or test), apply
the canonical schema directly:

```bash
psql $DATABASE_URL -f db/schema.sql
```

`db/schema.sql` is the authoritative source of truth containing all base tables,
columns, enums, triggers, and baseline indexes actively used by application routes (#1867).
Once initialized with `schema.sql`, record legacy migrations with:

```bash
npm run db:migrate -- baseline --all-legacy
```

Then run versioned migrations with:

```bash
npm run db:migrate -- up
```

## Legacy Migrations (Frozen)

The 16 files listed in `legacy-manifest.json` predate the tracked migration runner and are immutable.
Each is verified by a schema probe during baselining:

- **add-stream-recording.sql** – Adds optional stream recording: `users.enable_recording`, `stream_sessions.title`/`playback_id`, and `stream_recordings` table. Run this before using the Record Live Streams toggle and recordings APIs.
- **add-needs-review.sql** – Adds `needs_review` flag on `stream_recordings` for Mux webhook reconciliation.
- **add-admin-panel.sql** – Adds user banning columns (`is_banned`, `banned_at`, `ban_reason`), `stream_reports`, and `bug_reports`.
- **20260327_routes_f_creator_finance_and_badges.sql** – Creator earnings, tip transactions, payouts, stream schedules, and badge definitions.
- **add-routes-f-platform-features.sql** – Moderation queue, channel emotes, global emotes, and tag suggestions.
- **add-latency-mode.sql** – Adds per-creator `latency_mode` to `users`.
- **add-transcription-jobs.sql** – Adds `transcription_jobs` for VOD auto-generated captions and WebVTT tracks.
- **add-user-sessions.sql** – Session revocation and active session tracking in `user_sessions`.
- **add-feature-flags-clips-whitelist-preferences.sql** – Feature flags, stream clips, whitelist, and viewer preferences.
- **20260427_backend_enhancements.sql** – Stream extensions catalog, overlays, co-stream invites, squads, and raids.
- **add-mux-provisioning-flags.sql** – Provisioning flags for DVR and signed playback on `users`.
- **add-stream-privacy-and-subs.sql** – Stream privacy controls, share tokens, subscription tiers, and subscriptions.
- **add-auth-email-tokens.sql** – Password reset, magic link, and email verification tokens.
- **add-user-two-factor.sql** – TOTP 2FA secret ciphertext and recovery codes backing security routes.
- **20260924_session_retention_analytics.sql** – Session retention timeseries and backfill tracking.
- **add-analytics-and-experimentation.sql** – Concurrent viewer cache, A/B testing experiment definitions, and event analytics.

## Versioned Migrations

New migrations are created with `npm run db:migrate -- create <name>` and follow the `YYYYMMDDHHMMSS_<name>.sql` naming standard.

- **20260925100000_custodial_key_kms.sql** – Adds `users.encrypted_stellar_key_legacy`, `users.custodial_key_migrated_at` and the `custodial_key_migration_events` audit table for the KMS migration (#1396). Run before deploying; then follow `docs/custodial-key-kms.md`.
- **20260925100100_mux_live_state_reconciliation.sql** – Adds `users.live_state_changed_at` (maintained by a trigger), an index on `users.mux_stream_id`, and `scheduled_job_runs` for cron leases/health (#1399). See `docs/mux-live-state-reconciliation.md`.
- **20260925100200_mux_webhook_idempotency.sql** – Adds `mux_webhook_events`, the persistent event-id store that makes every Mux webhook apply at most once (#1397). Run before deploying the webhook changes. See `docs/mux-webhook-idempotency.md`.
- **20260925190000_chat_poll_indexes.sql** – Indexes for the chat poll path (#1410). `-- migrate:no-transaction` (`CREATE INDEX CONCURRENTLY`). Safe before or after deploying. See `docs/postgres-pooling-and-chat-load.md`.
- **20260925190100_retire_livepeer_columns.sql** – Archives Livepeer-era IDs into `legacy_livepeer_refs`, then drops the legacy columns and indexes (#1408). Run `scripts/audit-livepeer-legacy.ts` and deploy the matching application code before `db:migrate up` applies it. Tested by `db/tests/retire-livepeer-columns.test.sql`. See `docs/livepeer-mux-audit.md`.
- **20260925200000 … 20260925210100** – Data-integrity migrations (#1405, #1406, #1407, #1409): JSONB contract functions, user tombstones and the purge function, Mux asset drift findings, tip reconciliation corrections and alerts, the online index/validation steps, and the JSONB CHECK constraints. `20260925210000` refuses to run until the JSONB audit reports no invalid rows. See `docs/data-integrity.md#deployment`; database tests in `db/tests/data-integrity.test.sql`.
- **20260926090000_background_job_dispatch.sql** – Adds `message_id`, `attempt` and `trigger` to `job_runs`, and the `job_dead_letters` table, for the QStash job infrastructure (#1416). Run before deploying. See `docs/background-jobs.md`.
- **20260926090100_tip_reconciliation_checkpoints.sql** – Adds `tip_reconciliation_checkpoints`, the per-creator progress of the resumable tip reconciliation (#1418). Run before deploying. See `docs/circuit-breakers.md`.
- **20260926100000 … 20260926100300** – Notifications table, backfill, hot-path indexes, and purge policies for notifications and the account-recovery tables (#1414, #1415). `20260926100200_hot_path_indexes` is `-- migrate:no-transaction` (`CREATE`/`DROP INDEX CONCURRENTLY`). Apply before deploying, then run the backfill file once more after the deploy. See `docs/database/migrations-20260926.md`.
- **20260928100000_admin_roles.sql** and **20260928100100_admin_audit_log.sql** – Promotes existing `admin` roles to `super_admin`, indexes user role identity lookups, and adds an append-only admin audit log. Import current environment allowlists with `npx tsx scripts/migrate-admin-allowlist.ts` before removing them. See [docs/admin-roles-and-audit.md](../../docs/admin-roles-and-audit.md).
- **20260928100200_session_list_pagination.sql** – Adds the index used to paginate active sessions by last activity.
- **20260928110000_security_controls.sql** – Adds stream-password attempt state, rolling login-session/anomaly history, encrypted TOTP enrollment/recovery, action-bound step-up challenges, and key-rotation checkpoints. Apply before deploying the security-control routes; see [docs/security-controls.md](../../docs/security-controls.md) and [docs/security-key-rotation.md](../../docs/security-key-rotation.md).
- **CSP rollout** – The report-only policy is supplied by `proxy.ts`; no database migration is needed. Keep it in report-only mode until the production review in [docs/content-security-policy.md](../../docs/content-security-policy.md) is complete.
