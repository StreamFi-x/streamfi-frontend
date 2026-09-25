# Database migrations

Run migrations in order when deploying schema changes.

- **add-stream-recording.sql** – Adds optional stream recording: `users.enable_recording`, `stream_sessions.title`/`playback_id`, and `stream_recordings` table. Run this before using the Record Live Streams toggle and recordings APIs.
- **20260925_chat_poll_indexes.sql** – Indexes for the chat poll path (#1410). Uses `CREATE INDEX CONCURRENTLY`; run with `psql -f` (not inside a transaction). Safe before or after deploying. See `docs/postgres-pooling-and-chat-load.md`.
- **20260925_retire_livepeer_columns.sql** – Archives Livepeer-era IDs into `legacy_livepeer_refs`, then drops the legacy columns and indexes (#1408). Run `scripts/audit-livepeer-legacy.ts` first and deploy the matching application code before applying. Tested by `db/tests/retire-livepeer-columns.test.sql`. See `docs/livepeer-mux-audit.md`.
