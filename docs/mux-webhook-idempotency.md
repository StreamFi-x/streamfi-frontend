# Mux webhook replay protection (#1397)

All three Mux webhook endpoints share one pipeline (`lib/mux/webhook.ts`):

```
signature + 300 s freshness check → parse → exactly-once processing (event id)
```

- `/api/webhooks/mux`
- `/api/routes-f/webhooks-mux-live`
- `/api/routes-f/webhooks-mux-asset`

The signature freshness check is unchanged and still rejects captured
requests replayed more than 5 minutes after signing. It is complementary to
idempotency: Mux signs **every delivery attempt** afresh, so a legitimate
retry hours later passes the signature check and must be caught by the event
id instead.

## Protected event types

| Event                      | Side effect                                                 | Endpoints   |
| -------------------------- | ----------------------------------------------------------- | ----------- |
| `video.live_stream.active` | user live, stream session opened                            | main, live  |
| `video.live_stream.idle`   | user offline, sessions closed                               | main, live  |
| `video.asset.ready`        | recording upserted (+ owner notified on asset endpoint)     | main, asset |
| `video.asset.errored`      | recording marked error (+ owner notified on asset endpoint) | main, asset |
| `video.asset.deleted`      | recording deleted                                           | asset       |

Log-only events (`connected`, `disconnected`, `live_stream.created/deleted`,
`asset.created`) have no side effects and do not touch the store.

## Processing semantics

Table `mux_webhook_events`, primary key `event_id` (Mux's event `id`, which
is identical across redeliveries).

1. Open a transaction.
2. `INSERT … ON CONFLICT (event_id) DO UPDATE … WHERE status = 'failed'
RETURNING` — claims the event if it is new, or if a previous attempt
   failed.
3. No row returned → already processed → respond `200 {duplicate: true}`
   without running anything.
4. Otherwise run the handler **in the same transaction**, then commit.

Consequences:

- **Concurrent duplicates**: the second delivery blocks on the first one's
  uncommitted primary-key entry. When the first commits, the second sees a
  processed row and is acknowledged as a duplicate. If the first rolls back,
  the second processes the event. A duplicate waits at most 10 s
  (`lock_timeout`), after which it gets a `500` and Mux retries it later.
- **Failures stay retryable**: any error rolls back the side effects _and_
  the claim, then records `status = 'failed'` (attempt count, truncated
  error) and returns `500` so Mux retries. A processed event is never
  reprocessed. After 3 failed attempts of one event, an operational alert
  fires (once per event per 6 h).
- **Atomicity is real**: every side effect of these handlers is a write to
  the same Postgres database, including owner notifications, so they commit
  or roll back together with the claim. Handlers must let errors propagate —
  swallowing one inside the transaction would leave it aborted.
- **Cross-endpoint**: if one event is delivered to more than one endpoint,
  it is still applied once.
- A side-effecting event without an `id` is rejected with `400`.

Transactions use `withTransaction` (`lib/postgres-transaction.ts`), which runs
on one pooled connection. The module-level `sql` tag may use a different
connection per statement and cannot form a transaction.

## Retention and cleanup

| Rows      | Kept for                                                                   |
| --------- | -------------------------------------------------------------------------- |
| processed | `MUX_WEBHOOK_EVENT_RETENTION_DAYS` (default 7, minimum 2) after processing |
| failed    | max(30 days, retention) after first receipt                                |

Why 7 days: Mux retries failed deliveries with backoff for up to about a day,
and dashboard "resend" can happen later still. A week covers that with a
margin for outages on our side. The 300 s signature window is irrelevant to
this choice. An event redelivered after its record has been purged would be
processed again; the minimum of 2 days keeps that outside Mux's retry
horizon.

Cleanup: `GET /api/routes-f/cron-purge-mux-webhook-events` (Vercel Cron,
daily at 03:30 UTC, `Authorization: Bearer $CRON_SECRET`). It deletes in
batches of 5,000 (max 20 batches per run), so it never holds long locks and
is safe alongside live webhook traffic. The same run also alerts if the Mux
reconciliation job has not succeeded in the last hour.

Expected size: one row per side-effecting event, ~200 bytes each. For
example, 5,000 streams/day × ~4 events ≈ 20k rows/day ≈ 140k rows (~30 MB
with indexes) at steady state.

## Structured log events

`mux_webhook_duplicate`, `mux_webhook_processing_failure`,
`mux_webhook_in_flight_duplicate`, `operational_alert`.
