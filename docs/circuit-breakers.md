# Circuit breakers and timeouts for Horizon and Mux (#1418)

Every server-side call to Horizon (Stellar) and Mux goes through a circuit
breaker with a hard timeout. When a dependency degrades, calls fail within the
timeout, then stop being made at all until the dependency has had time to
recover. A request never hangs until the platform kills the function.

Code: `lib/resilience/circuit-breaker.ts` (the breaker),
`lib/resilience/breaker-store.ts` (shared state), `lib/resilience/breakers.ts`
(the Horizon and Mux instances).

## States

```
closed ──(≥ threshold failures and failure rate ≥ rate, within the window)──▶ open
open ──(cooldown elapsed; one caller takes the probe lease)──▶ half_open
half_open ──probe succeeds──▶ closed
half_open ──probe fails──▶ open (new cooldown)
```

- **Closed:** calls go through. Each outcome is recorded in a rolling window.
- **Open:** calls throw `CircuitOpenError` (with `retryAfterMs`) without
  touching the dependency.
- **Half-open:** exactly one caller gets a probe lease and makes the call.
  Everyone else keeps failing fast until the probe reports. If the probe
  never reports (the instance died), the lease (timeout + 1s) lapses and the
  next caller probes.

## Shared state (Upstash Redis)

Serverless instances do not share memory, so the state is in Redis, per
breaker:

- `cb:{<name>}:state`: a hash with `state`, `open_until`, `probe_until` and
  `probe_id`.
- `cb:{<name>}:failures` and `cb:{<name>}:calls`: sorted sets of recent
  outcomes, trimmed to the window and capped at 1,000 entries.

Every transition is one Lua script (`ACQUIRE_SCRIPT`, `RECORD_SCRIPT`), so it
is atomic: concurrent callers cannot all take the half-open probe, and two
instances cannot both open (or both close) the breaker. A late report from an
abandoned probe is ignored, because it no longer holds `probe_id`. Outcomes of
calls that started before the breaker opened are ignored while it is open.
Keys expire on their own.

**Redis unavailable or slow** (no answer within 750ms): the call proceeds on a
per-instance breaker with the same algorithm, and a warning is logged at most
once a minute. Redis problems degrade protection to per-instance. They never
block calls to Horizon or Mux (same policy as `lib/rate-limit.ts`).

The test suite runs the same state-machine tests against both stores; set
`TEST_UPSTASH_REDIS_REST_URL` / `TEST_UPSTASH_REDIS_REST_TOKEN` (for example a
local Redis behind `hiett/serverless-redis-http`) to run the Redis half.

## Configuration

| Setting            | Horizon | Mux    | Env override                  |
| ------------------ | ------- | ------ | ----------------------------- |
| `timeoutMs`        | 8,000   | 10,000 | `CB_<NAME>_TIMEOUT_MS`        |
| `failureThreshold` | 5       | 5      | `CB_<NAME>_FAILURE_THRESHOLD` |
| `failureRate`      | 0.5     | 0.5    | `CB_<NAME>_FAILURE_RATE`      |
| `windowMs`         | 60,000  | 60,000 | `CB_<NAME>_WINDOW_MS`         |
| `cooldownMs`       | 30,000  | 30,000 | `CB_<NAME>_COOLDOWN_MS`       |

`<NAME>` is `HORIZON` or `MUX`. The breaker opens when both conditions hold:
at least `failureThreshold` failures, and failures making up at least
`failureRate` of all calls in the window. One or two blips never open it.
The reasoning behind each default is in `lib/resilience/breakers.ts`.

An invalid override (non-numeric, zero, a rate above 1) is ignored with a
warning and the default is kept. Invalid configuration passed in code throws
at construction. Neither can switch protection off.

## Timeouts and what counts as a failure

The breaker aborts the call at `timeoutMs` through an `AbortSignal` passed to
the HTTP client. The Horizon SDK client's own timeout is set to the same
value, and Mux requests get `{ signal, timeout }`, so a slow request is
cancelled rather than left running.

| Outcome                                   | Counts against the dependency                                               |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| Timeout (ours, the client's, or HTTP 408) | yes                                                                         |
| Network error (no response)               | yes                                                                         |
| HTTP 429                                  | yes (back off from a rate-limiting dependency)                              |
| HTTP 5xx                                  | yes                                                                         |
| HTTP 4xx other than 408/429               | no: a correct answer (e.g. 404 for an unfunded account or a deleted stream) |

Mux SDK retries are off (`maxRetries: 0`). They multiplied the worst-case
wait inside one call (by default 60s × 3), and retrying a timed-out
`liveStreams.create` could create a second live stream. The old 8s
`Promise.race` around stream creation, which did not cancel the request, is
replaced by the breaker's timeout.

## Independence

Horizon and Mux have separate breaker instances, Redis keys, thresholds,
cooldowns, timeouts and log fields (`breaker: "horizon" | "mux"`). A Mux
outage never makes Horizon calls fail, and the reverse. Tests cover both
directions.

## Where they are used

**Horizon** (`lib/stellar/horizon-client.ts`: `callHorizon`,
`fetchHorizonJson`, a shared `Horizon.Server` per network):

- `lib/stellar/horizon.ts`: payment history (tip reconciliation, creator
  analytics).
- `GET /api/wallet/balance` and `GET /api/wallet/funding-status`, through
  `lib/stellar/balance.ts`. Horizon unavailable → 503 with `Retry-After`.
- `POST /api/routes-f/webhooks-stellar-payment` transaction verification.
  Horizon unavailable → 503, so the sender retries instead of the payment
  being rejected as unverifiable. The operations link is a URI template
  (`…/operations{?cursor,limit,order}`) and is now stripped before fetching.
- `POST /api/routes-f/tip-confirm`. Horizon unavailable → 503, not the
  previous 404 "transaction not found".
- `lib/routes-f/payouts.ts` `getUsdcBalance`.

Not wrapped: `lib/stellar/payments.ts`, which is also bundled into the browser
(`TipModal` builds and signs transactions client-side), and
`submitTransaction`. A timed-out submit may still have been applied, so it
must not be retried or counted like a read.

**Mux:** every call in `lib/mux/server.ts`. `getMuxLiveStreamState` reports an
open circuit as `unknown`, which the session reconciliation never acts on.

## Tip refresh

`POST /api/tips/refresh-total` used to walk a creator's whole Horizon payment
history inside one request: up to 100 pages, each retried up to 5 times with
backoff of up to 8s, with no per-request timeout. It is now a bounded step of
a resumable, checkpointed walk (`lib/stellar/tip-reconciliation.ts`,
`tip_reconciliation_checkpoints`).

**How the walk works.** The history is read oldest first (`order=asc`), one
page at a time. After each page:

1. The page's tips are inserted into `tip_transactions`, idempotently
   (`ON CONFLICT (tx_hash) DO NOTHING`).
2. The checkpoint is advanced with a compare-and-set on its cursor:
   `SET cursor = <next>, total_stroops = total_stroops + <page sum>, ...
WHERE cursor IS NOT DISTINCT FROM <previous>`.

`users.total_tips_*` is written only when the walk reaches the end of the
history (an empty page), from the checkpoint's totals.

**Partial failure.** Suppose tips 1–3 are processed, Horizon times out on 4,
and 5 is never read:

- Persisted: tips 1–3 in `tip_transactions`, and the checkpoint at tip 3 with
  the running total of 1–3.
- Not changed: `users.total_tips_*`. A partial sum is never shown.
- Next call: resumes at the checkpoint and reads tip 4 onwards.
- A crash between steps 1 and 2 re-reads that page on the next call. The
  inserts are no-ops and the checkpoint advances once. Nothing is double
  counted, so no transaction is needed.
- Two concurrent workers: the loser's compare-and-set matches no row and it
  stops (`superseded`). A page is never added twice.
- Earlier successful pages are not rolled back: each page is a complete,
  valid unit, and the ledger is append-only, so a total up to the cursor
  never changes.

**Concurrent webhook credits.** `users.tip_totals_version` is read before the
final page, and the totals are written only if it is unchanged. If the
payment webhook credited a new tip meanwhile, the walk reads one more page
(which now contains that payment) and writes again. After 3 lost writes it
gives up with `stale` rather than loop.

**Afterwards.** The checkpoint stays. Later reconciliations only read payments
newer than the cursor. A changed wallet, or a bump of
`TIP_DEFINITION_VERSION` (when the definition of a tip changes), restarts the
walk from the beginning.

**What the route does.** It reads up to 10 pages or 6 seconds:

| Result                                                                  | Response                                                                                                                                                                  |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Walk reached the end                                                    | 200 `refreshed: true` with the new totals                                                                                                                                 |
| History too long for one request                                        | 202 `status: "in_progress"` with the stored totals, and the `tip-refresh-creator` background job ([background-jobs.md](background-jobs.md)) continues from the checkpoint |
| Horizon down or circuit open                                            | 503 with `Retry-After`, at once; progress so far is kept                                                                                                                  |
| Another worker is advancing the same creator, or concurrent writers won | 409                                                                                                                                                                       |

The whole request is bounded at roughly 15 seconds even when Horizon hangs:
the 6s budget plus one in-flight page capped at 8s. The per-creator lock TTL
is now 30s. The old `422` for histories over 100 pages is gone: long
histories finish in the background.

The scheduled reconciliation job uses the same walk (20 pages per creator per
run). A creator whose history needs more pages keeps its place in the queue.
When Horizon's circuit opens mid-run, the remaining creators are deferred
(not counted as failures) and the run alerts once.

The in-request retry and backoff loop was removed on purpose. It is what made
a single request unbounded. Transient failures are now retried by the next
refresh, the next scheduled run, or QStash's backoff for the background job.
