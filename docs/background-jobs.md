# Background jobs (#1416)

Scheduled and background work runs on **Upstash QStash**. QStash calls
`POST /api/jobs/<name>` with a signed request, retries failed deliveries with
backoff, and keeps messages that exhausted their retries in its DLQ. Every run
is recorded in Postgres (`job_runs`), and every job execution that will not be
retried again is recorded in `job_dead_letters` and alerted.

## Why QStash

What was there before:

- `vercel.json` listed several crons but was **invalid JSON** after a merge
  (two objects were fused together), so no cron in it could deploy. One entry
  (`/api/routes-f/schedule/reminders`) pointed at a route deleted in `7fbe825`;
  it has been removed. The JSON is fixed.
- Two incompatible lease/health helpers had been merged over each other
  (`scheduled_job_runs` from #1399 and `job_locks`/`job_runs` from #1400), so
  three cron routes did not type-check. The `job_runs` version is restored as
  `lib/jobs/scheduled-job.ts`, and the Mux cron jobs' version lives on as
  `lib/jobs/leased-job.ts` (see "Known gaps").
- There was no retry, backoff or dead-letter handling anywhere: a failed run
  was logged and forgotten until the next tick.
- Commit `d34daba` cut the only cron to daily "for hobby plan". Vercel Hobby
  runs crons at most once a day, so the sub-daily schedules (every 5, 10 and
  15 minutes) only work on a paid Vercel plan.

|                       | Vercel Cron                      | QStash (chosen)                            | Dedicated worker            |
| --------------------- | -------------------------------- | ------------------------------------------ | --------------------------- |
| Frequency             | Daily on Hobby; any on Pro       | Any, independent of the Vercel plan        | Any                         |
| Retries               | None; the next tick is the retry | Per message, with backoff                  | Build it                    |
| Dead letters          | None                             | DLQ, plus `job_dead_letters` here          | Build it                    |
| Auth                  | `CRON_SECRET` bearer             | Signed JWT over URL and body, key rotation | Private network             |
| Dispatch one-off work | No                               | Yes (`publishJSON`, delay, dedup id)       | Yes                         |
| New infrastructure    | None                             | QStash, same Upstash account as Redis      | A host, deploys, monitoring |
| Runtime               | Serverless function              | Same serverless function                   | Long-running process        |

A dedicated worker would step outside the serverless model the rest of the
platform uses, for work that fits in a function call. Vercel Cron alone cannot
retry, dead-letter or dispatch per-item work, which the tip reconciliation
(#1418) needs. QStash adds those, delivers to the same routes, and is billed
by the provider the platform already uses for Redis.

The endpoint also accepts `Authorization: Bearer $CRON_SECRET` (POST, or GET
for jobs without a payload), for manual runs and so the same job can still be
triggered by Vercel Cron if the team prefers.

## Defining a job

```ts
// lib/jobs/definitions/<area>.ts
export const myJob = defineJob({
  name: "my-job", // URL segment and job_runs.job_name
  description: "What it does",
  schedule: "*/15 * * * *", // optional: QStash cron (UTC)
  expectedIntervalSeconds: 900, // optional: alert after 3x without success
  maxAttempts: 3, // deliveries including the first (max 5)
  timeoutSeconds: 55, // hard limit per run (max 55; route maxDuration 60)
  leaseSeconds: 90, // > timeoutSeconds; also QStash's delivery timeout
  leaseKey: payload => `my-job:${payload.id}`, // optional; default: one run per job
  parsePayload: raw => validate(raw), // throw PermanentJobError when invalid
  run: async ({ payload, delivery, dispatch }) => ({
    status: "succeeded",
    metrics: {},
  }),
});
```

Register it in `lib/jobs/registry.ts`. Only registered jobs exist at
`/api/jobs/<name>`, and every payload goes through the job's own
`parsePayload`, so a caller cannot make the endpoint do arbitrary work. For a
scheduled job, run `npm run jobs:sync-schedules` (idempotent; `--dry-run`
prints the plan) to create or update its QStash schedule. It also deletes
schedules it created for jobs that no longer exist.

To queue work from anywhere: `dispatchJob(job, payload, { deduplicationId,
delaySeconds })` (`lib/jobs/qstash.ts`). It returns `{ dispatched: false,
reason: "not_configured" }` instead of throwing when QStash is not set up, so
callers can degrade.

### The contract a job must meet

- **Idempotent.** QStash delivers at least once, and a retried attempt runs
  again after partial progress. Nothing here provides exactly-once delivery.
- **Safe to overlap.** The lease avoids duplicate work, but a run that hit its
  time limit may still be finishing when its retry starts.
- **Bounded.** Finish inside `timeoutSeconds`; split long work into
  continuations with `ctx.dispatch`.
- **No secrets in payloads.** Payloads are stored in QStash and in
  `job_dead_letters`. Pass ids and look the data up.

## What happens to a delivery (`lib/jobs/execute.ts`)

| Outcome                                | Response            | Effect                                                                                                          |
| -------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `succeeded` / `partial`                | 200                 | Done. A dead letter for the same message (a DLQ replay) is marked resolved.                                     |
| Lease held by another run              | 200 `skipped`       | That run is doing the work.                                                                                     |
| Message already succeeded              | 200 `duplicate`     | Not run again.                                                                                                  |
| Failed, attempts left                  | 500 `retry`         | QStash retries with backoff.                                                                                    |
| Failed on the last attempt             | 500 `dead_lettered` | Row in `job_dead_letters` (`retries_exhausted`) and a critical alert. QStash also moves the message to its DLQ. |
| `PermanentJobError` or invalid payload | 200 `dead_lettered` | Recorded (`permanent`) and alerted at once, never retried.                                                      |
| Operator run (`CRON_SECRET`) fails     | 500                 | No retries, no dead letter: the caller sees the failure.                                                        |

A run "fails" when it throws, returns `status: "failed"`, or exceeds
`timeoutSeconds` (so it is recorded and retried instead of being killed by the
platform with its lease still held).

The attempt number is the larger of QStash's `Upstash-Retried` header + 1 and
the failed runs already recorded for that message id, so it is right even if
the header is missing.

Observability: every run is a row in `job_runs` (status, attempt, message id,
trigger, duration, metrics, error). Dead letters are in `job_dead_letters`
with the payload, attempt count and error, and raise a `background_jobs`
operational alert (`lib/security/alerts.ts`, delivered to
`OPS_ALERT_WEBHOOK_URL` when set). Scheduled jobs also alert after three
consecutive failures or when no run has succeeded for three intervals.

```sql
-- open dead letters
SELECT job_name, message_id, attempts, reason, error, dead_lettered_at
  FROM job_dead_letters WHERE resolved_at IS NULL ORDER BY dead_lettered_at DESC;
```

To replay one, retry the message from the QStash DLQ (console or
`client.dlq.retry`). A successful replay resolves the dead letter here.

## Jobs on this infrastructure

- **`tip-total-reconciliation`** (every 15 minutes). The #1400 scheduled
  reconciliation, moved off Vercel Cron: `/api/routes-f/cron-reconcile-tip-totals`
  and its `vercel.json` entry are gone. 3 attempts.
- **`tip-refresh-creator`** (dispatched). Finishes one creator's tip
  reconciliation when a manual refresh runs out of its request budget. 4
  attempts; a Horizon failure fails the delivery so QStash retries it later,
  and it resumes from the saved checkpoint. See
  [circuit-breakers.md](circuit-breakers.md#tip-refresh).

## Setup

1. Apply `db/migrations/20260926090000_background_job_dispatch.sql` (and the
   other pending migrations) with `npm run db:migrate -- up`.
2. Set `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`
   and `JOBS_BASE_URL` (the public origin, e.g. `https://streamfi.xyz`; falls
   back to `NEXT_PUBLIC_APP_URL`). Signatures are checked against
   `JOBS_BASE_URL + /api/jobs/<name>`, so it must be the URL QStash calls.
3. Deploy, then run `npm run jobs:sync-schedules`.

Until QStash is configured, the endpoint rejects signed requests (fail
closed), `tip-total-reconciliation` does not run on a schedule, and manual
refreshes that need more than one request are finished by the next scheduled
run instead of a background job.

## Known gaps

- The other cron routes in `vercel.json` still use Vercel Cron. The Mux jobs
  use `lib/jobs/leased-job.ts` (`scheduled_job_runs`), which has leases,
  health tracking and alerts but no retries. Moving each onto `defineJob` is
  mechanical but was left out of this change.
- `cron-refresh-materialized-views` and `cron-cleanup-expired-clips` export
  only `POST`, while Vercel Cron sends `GET`, and no migration creates the
  tables they use. They are unchanged here.
