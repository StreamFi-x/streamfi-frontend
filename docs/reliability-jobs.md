# Reliability jobs

Scheduled consistency jobs. The session reconciliation runs on Vercel Cron
(`vercel.json`, `Authorization: Bearer $CRON_SECRET`). The tip reconciliation
runs on the QStash job infrastructure, with retries and dead letters; see
[background-jobs.md](background-jobs.md).

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

Background job `tip-total-reconciliation` (QStash, every 15 minutes; it
replaced the Vercel Cron route `/api/routes-f/cron-reconcile-tip-totals`).
Logic is in `lib/stellar/tip-reconciliation.ts`, and
`POST /api/tips/refresh-total` uses the same code. Since #1418 the walk is
resumable and bounded per call; the details are in
[circuit-breakers.md](circuit-breakers.md#tip-refresh).

- **Source of truth:** the account's complete Horizon payment history, walked
  oldest first and checkpointed per page (`tip_reconciliation_checkpoints`).
  The first reconciliation covers the whole history (over as many runs as it
  takes); later ones read only newer payments. It uses the existing tip
  definition (incoming native XLM `payment` / `path_payment_strict_receive`,
  see `lib/stellar/horizon.ts`). Amounts are summed in stroops (BigInt), not
  floats. Totals are written only once the walk reaches the end, never
  partially.
- **Selection:** each run claims up to `TIP_RECONCILE_BATCH_SIZE` users (default 25) that have a Stellar `G…` wallet and a stale total (older than
  `TIP_RECONCILE_STALE_MINUTES`, default 360). Users never reconciled come
  first, then the oldest. The claim uses `FOR UPDATE SKIP LOCKED`, so
  overlapping runs never pick the same user. A user whose reconciliation
  failed waits 30 minutes before it is tried again.
- **Horizon:** `TIP_RECONCILE_CONCURRENCY` users are processed at a time
  (default 2), at most 20 pages each per run; a longer history continues next
  run. Horizon calls go through the Horizon circuit breaker (8s timeout).
  Once the circuit opens, no new users are started and the remaining ones go
  back into the queue. New pages and users are not started after 45 seconds.
  A failed run is retried by QStash (3 attempts), then dead-lettered.
- **Concurrency:** every writer of the totals bumps
  `users.tip_totals_version`: manual refresh, the scheduled job and the
  Stellar payment webhook. A reconciliation writes only if the version is
  unchanged since just before the final page was read; otherwise it reads the
  newer payments and tries again (up to 3 times), so a slow run never
  overwrites a newer manual refresh or a webhook credit. Pages are
  checkpointed with a compare-and-set on the cursor, so concurrent runs never
  count a page twice.
- **Fixes made along the way:** `ON CONFLICT (tx_hash)` did not match the
  partial unique index on `tip_transactions`. It now repeats the index
  predicate. Before this, `refresh-total` returned 500 for any user with at
  least one tip. The payment webhook now credits the totals only when its
  insert actually happened, so a transaction delivered twice at once is
  credited once.
- **Alert:** totals corrected by at least 100 XLM (one alert per run), and a run
  stopped early because Horizon's circuit opened.
- **Metrics:** selected, reconciled, corrected, unchanged, in_progress,
  stale_skipped, failed, deferred, ledger_requests, ledger_pages,
  large_discrepancies.
