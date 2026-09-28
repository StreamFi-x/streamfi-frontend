# Database migrations

Run migrations in order when deploying schema changes.

- **add-stream-recording.sql** – Adds optional stream recording: `users.enable_recording`, `stream_sessions.title`/`playback_id`, and `stream_recordings` table. Run this before using the Record Live Streams toggle and recordings APIs.
- **20260928110000_security_controls.sql** – Adds stream-password attempt state, rolling login-session/anomaly history, encrypted TOTP enrollment/recovery, action-bound step-up challenges, and key-rotation checkpoints. Apply before deploying the security-control routes; see [docs/security-controls.md](../../docs/security-controls.md) and [docs/security-key-rotation.md](../../docs/security-key-rotation.md).
