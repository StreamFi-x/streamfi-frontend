# feat: transcription management API for VOD captions

Implements the transcription API at `app/api/routes-f/stream/transcription/` as specified.

## What's included

- `GET /api/routes-f/stream/transcription?recording_id=` — returns job status and content (only when ready)
- `POST /api/routes-f/stream/transcription` — triggers a transcription job; ownership-gated
- `GET /api/routes-f/stream/transcription/[id]/vtt` — streams the WebVTT file with `Content-Type: text/vtt`
- `db/migrations/add-transcription-jobs.sql` — new `transcription_jobs` table with status constraint, indexes, and `UNIQUE(recording_id)`

## Performance notes

- GET query uses `CASE WHEN status = 'ready' THEN content ELSE NULL END` to avoid fetching large VTT text on non-ready jobs
- POST uses `INSERT ... ON CONFLICT DO UPDATE` to collapse the existence-check + insert into a single round-trip

## Auth & ownership

- All endpoints require a valid session (401 otherwise)
- POST verifies `stream_recordings.user_id = session.userId` before creating a job (403 otherwise)
- GET and VTT endpoints enforce the same ownership check

## Tests

Vitest unit tests in `__tests__/transcription.test.ts` covering:
- GET returns correct status and content
- GET omits content when not ready
- POST triggers job and returns `pending`
- POST rejects non-owner with 403
- VTT streams with `Content-Type: text/vtt`
- VTT returns 404 when not ready / not found
- All endpoints return 401 for unauthenticated requests

## Migration

Run before deploying:
```sql
\i db/migrations/add-transcription-jobs.sql
```

Closes #<issue-number>
