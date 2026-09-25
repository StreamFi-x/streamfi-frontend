# Mux ↔ DB live-state reconciliation (#1399)

Webhooks keep `users.is_live` in sync in real time. A missed webhook used to
leave the state wrong forever. `GET /api/routes-f/cron-mux-reconcile`
(Vercel Cron, every 5 minutes) treats Mux as the source of truth and repairs
drift in both directions.

Code: `lib/mux/reconciliation.ts`, `lib/mux/live-state.ts` (transitions
shared with the webhooks), `lib/jobs/scheduled-job.ts` (lease + health).

## Algorithm

1. Read the DB clock (`observed_at`) **before** asking Mux.
2. List every `active` live stream from Mux (`status=active`, 100 per page,
   up to 50 pages, 10 s timeout, SDK retries). Any error, malformed entry or
   hitting the page cap aborts the run **before any write**.
3. **DB live, Mux not active** → re-confirm each candidate with a direct
   `GET /live-streams/:id` (at most `MUX_RECONCILE_MAX_CONFIRMATIONS`, default
   25, per run; the rest are deferred to the next run). Only a confirmed
   non-`active` status (`idle`, `disabled`, 404) ends the stream: user set
   offline, open `stream_sessions` closed. A failed lookup skips that row.
   Rows marked live with no `mux_stream_id` cannot be live and are ended
   without a lookup.
4. **DB not live, Mux active** → user set live and a stream session opened
   (same bookkeeping as the `active` webhook). Banned users are never brought
   back live.

Mux API cost per run: 1 list call per 100 active streams, plus one lookup
per discrepancy (bounded).

## Race protection

Every correction is a conditional `UPDATE`, one transaction per user, that
applies only if:

- the row still has the state the job observed (`is_live`, `mux_stream_id`),
  **and**
- `users.live_state_changed_at < observed_at − grace`.

`live_state_changed_at` is maintained by a trigger whenever `is_live`
actually flips, whoever flips it (webhook, `/api/streams/start`, admin
suspension, this job). So if a webhook changes a stream's state at any point
after the job read the clock, its change is newer than the observation and
the job leaves it alone:

```
T0 job reads clock + lists Mux (alice not active)
T1 alice starts streaming
T2 active webhook → is_live = true, live_state_changed_at = T2
T3 job: "end alice?" → WHERE live_state_changed_at < T0 − grace → no-op
```

Transitions lock the users row first, so a webhook and a correction for the
same streamer serialize, and a session is only opened if none is open. A
late webhook arriving after a correction never creates a duplicate session.

**Grace window**: `MUX_RECONCILE_GRACE_SECONDS`, default 180 (clamped to
30–3600). It covers Mux API propagation delay (the list endpoint lagging a
stream that just started or stopped) and webhooks queued just before the run.
It is well under the 5-minute schedule, so drift is still repaired within one
or two runs.

## Monitoring

- Runs hold a DB lease (`scheduled_job_runs`, 120 s) so invocations never
  overlap. A crashed run's lease simply expires. A run that exceeds its 45 s
  budget is recorded as failed but keeps its lease until expiry, because its
  work may still be in flight.
- Each run records start/finish, success/failure, error, consecutive
  failures and a summary in `scheduled_job_runs`.
- A failed run returns `500` (visible in Vercel cron logs) and raises an
  alert: warning, escalating to critical from 3 consecutive failures,
  de-duplicated per 30 minutes.
- The daily webhook-purge cron alerts if this job has not succeeded in the
  last hour, catching a cron that stopped firing.

## Drift alerting

Individual corrections are logged, not alerted. Alerts fire when:

- a single run corrects (or defers) ≥ `MUX_RECONCILE_DRIFT_ALERT_THRESHOLD`
  streams (default 5): "webhook delivery may be degraded" (critical, 1/h);
- drift is found on ≥ `MUX_RECONCILE_PERSISTENT_DRIFT_RUNS` consecutive runs
  (default 3): warning, 1 per 6 h.

## Logging

Every correction emits `mux_reconciliation_correction` with
`source: "reconciliation"` (webhook handlers never use that event), plus
`user_id`, `mux_stream_id`, `previous_db_state`, `observed_mux_state`,
`correction`, `reason`, `observed_at`, `live_state_changed_at` and sessions
opened or closed. Also `mux_reconciliation_confirmation_failed`,
`scheduled_job_completed`, `mux_live_reconciliation_failure`.

## Relationship to other jobs

`/api/routes-f/cron-close-inactive-sessions` (not scheduled in
`vercel.json`) and PR #1626 (orphaned `stream_sessions` for users who are
not live) address adjacent problems. This job only ends sessions of users it
corrects, using the same transition helpers as the webhooks.

## Configuration

`CRON_SECRET` (required), `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET`,
`MUX_RECONCILE_GRACE_SECONDS`, `MUX_RECONCILE_MAX_CONFIRMATIONS`,
`MUX_RECONCILE_DRIFT_ALERT_THRESHOLD`,
`MUX_RECONCILE_PERSISTENT_DRIFT_RUNS`, `OPS_ALERT_WEBHOOK_URL`.

Vercel Cron schedules more frequent than daily need a Pro plan; the repo
already schedules an hourly job.
