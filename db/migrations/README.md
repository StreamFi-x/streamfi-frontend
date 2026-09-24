# Database migrations

Run migrations in order when deploying schema changes.

- **add-stream-recording.sql** – Adds optional stream recording: `users.enable_recording`, `stream_sessions.title`/`playback_id`, and `stream_recordings` table. Run this before using the Record Live Streams toggle and recordings APIs.
- **add-stream-session-ended-at-estimated.sql** – Adds `stream_sessions.ended_at_estimated` (flag for a backfilled, estimated end time) and a partial index on open sessions. Run this before enabling the orphaned-session reaper cron (`/api/routes-f/cron-reap-orphan-sessions`).
