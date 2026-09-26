# Reliability jobs

Scheduled consistency jobs, run by Vercel Cron (`vercel.json`). They
authenticate with `Authorization: Bearer $CRON_SECRET`.

## Shared behaviour (`lib/jobs/scheduled-job.ts`)

- **No overlap:** each run takes a lease in `job_locks` with one atomic upsert.
  A second invocation while the lease is live returns `skipped`. A lease from
  a crashed run expires on its own.
- **Run log:** every run (including skipped and failed runs) is recorded in
  `job_runs` with its status, duration and counters.
- **Alerts:** each alert is written as one `logger.error` line with
  `alert: true`, at most once per condition per run. There is no paging
  integration in this codebase, so route alerts from the log drain. Alert
  conditions:
  - three consecutive failed runs;
  - no successful run for three schedule intervals (checked at the start of
    the next run);
  - job-specific conditions, listed below.
- **Status codes:** HTTP 200 on success, 207 on partial success, 500 on
  failure.

## Stream session reconciliation (#1402)

`GET /api/routes-f/cron-close-inactive-sessions`, every 10 minutes. Logic is in
`lib/stream/session-reconciliation.ts`. This reworks the existing route rather
than adding a second definition of "live". The old version closed sessions
whenever Mux errored and was never scheduled.

- **Orphan:** a session with `ended_at IS NULL`, at least 10 minutes old, whose
  Mux live stream (`stream_sessions.mux_session_id`, falling back to
  `users.mux_stream_id`) is `idle`, `disabled` or deleted (404). A session's
  age alone never closes it. Rate limits, 5xx responses and network errors mean
  the stream's state is unknown, so the session is left open. After 3 rate-limit
  responses the run stops calling Mux.
- **Estimated end:** `ended_at` is set to the session's last activity (latest
  chat message, viewer join or viewer leave). It is never earlier than
  `started_at`, never later than the moment Mux was observed, and never more
  than 12 hours after `started_at` (Mux's max continuous duration). Rows closed
  this way get `end_source = 'reconciliation'`; `NULL` means an event-driven
  close. The session analytics APIs expose this as `ended_at_estimated`, and
  the dashboard prefixes estimated durations with `~`.
- **Race safety:** closing is a single conditional `UPDATE` on
  `ended_at IS NULL`. It is skipped if the user went live again after Mux was
  observed (`users.stream_started_at` is later than the observation time).
  Open `stream_viewers` rows are closed at the same end time. `is_live` is
  cleared only when the user has no open session left.
- **Duplicates:** if a live user has more than one open session, the older ones
  are closed at the start time of the next one.
- **Alert:** abnormal correction rate (at least 5 closes making up at least 50%
  of inspected sessions), and Mux unavailable for every checked stream.
- **Metrics:** inspected, active_skipped, orphans_found, closed,
  duplicates_closed, race_skipped, unverifiable_skipped, mux_calls,
  mux_unavailable, mux_rate_limited, users_marked_offline, db_errors.

## Viewer count reconciliation (#1403)

`GET /api/routes-f/cron-reconcile-viewer-counts`, every 2 minutes. Logic is in
`lib/stream/viewer-count-reconciliation.ts`.

- **Problem:** `users.current_viewers` is an independently maintained counter,
  incremented on join and decremented on leave
  (`app/api/streams/viewers/route.ts`). A viewer whose leave call never fires
  (closed tab, lost connection, crashed browser) leaves the counter
  permanently too high, with no other job correcting it while the stream
  stays live (the existing reconciliation jobs only zero it on a full
  offline transition).
- **Heartbeat:** the watch page touches `stream_viewers.heartbeat_at` every
  30 seconds while a viewer is actually on the page
  (`db/migrations/20260926121650_add_stream_viewer_heartbeat.sql`). A row
  whose heartbeat (falling back to `joined_at` for rows from before this
  column existed) is older than `staleWindowSeconds` (default 90) is treated
  as abandoned: its `left_at` is set, closing it.
- **Source of truth:** after the sweep above, `current_viewers` for each live
  stream is set to the exact count of that stream's still-open
  `stream_viewers` rows (`left_at IS NULL`, on a not-yet-ended session). The
  write is a conditional `UPDATE ... WHERE current_viewers IS DISTINCT FROM`
  the true count, so a stream whose counter is already correct is never
  touched.
- **Race safety:** the true count is read after the abandonment sweep in the
  same pass, and the correcting `UPDATE` only overwrites the value if it is
  actually wrong at the moment it runs; a join or leave racing with this job
  either already matches (no-op) or is corrected on the next run, so this job
  never overwrites a legitimate concurrent change with a stale count.
- **Alert:** abnormal correction rate (at least 10 corrections making up at
  least 30% of inspected live streams).
- **Metrics:** live_streams_inspected, abandoned_viewers_closed,
  counters_corrected, counters_already_accurate, db_errors.

## Stellar tip total reconciliation (#1400)

`GET /api/routes-f/cron-reconcile-tip-totals`, every 15 minutes. Logic is in
`lib/stellar/tip-reconciliation.ts`, and `POST /api/tips/refresh-total` uses the
same code.

- **Source of truth:** a full recalculation over the account's complete Horizon
  payment history. It uses the existing tip definition (incoming native XLM
  `payment` / `path_payment_strict_receive`, see `lib/stellar/horizon.ts`).
  Amounts are summed in stroops (BigInt), not floats. Histories longer than
  100 pages fail instead of writing a partial total.
- **Selection:** each run claims up to `TIP_RECONCILE_BATCH_SIZE` users (default 25) that have a Stellar `G…` wallet and a stale total (older than
  `TIP_RECONCILE_STALE_MINUTES`, default 360). Users never reconciled come
  first, then the oldest. The claim uses `FOR UPDATE SKIP LOCKED`, so
  overlapping runs never pick the same user. A user whose reconciliation
  failed waits 30 minutes before it is tried again.
- **Horizon:** `TIP_RECONCILE_CONCURRENCY` users are processed at a time
  (default 2). Responses of 429, 5xx and network errors are retried up to 4
  times with capped exponential backoff and jitter. A user that is still rate
  limited after that stops the run, and the remaining users go back into the
  queue. New users are not started after 45 seconds.
- **Concurrency:** every writer of the totals bumps
  `users.tip_totals_version`: manual refresh, the scheduled job and the
  Stellar payment webhook. A reconciliation writes only if the version is
  unchanged since it started, so a slow run never overwrites a newer manual
  refresh or a webhook credit. The manual endpoint retries up to 3 times.
- **Fixes made along the way:** `ON CONFLICT (tx_hash)` did not match the
  partial unique index on `tip_transactions`. It now repeats the index
  predicate. Before this, `refresh-total` returned 500 for any user with at
  least one tip. The payment webhook now credits the totals only when its
  insert actually happened, so a transaction delivered twice at once is
  credited once.
- **Alert:** totals corrected by at least 100 XLM (one alert per run), and a run
  stopped early by Horizon rate limiting.
- **Metrics:** selected, reconciled, corrected, unchanged, stale_skipped,
  failed, deferred, ledger_requests, retries, rate_limited,
  large_discrepancies.
