# Read-replica routing for analytics and reporting

Analytics and reporting reads can run on a Postgres read replica, so heavy
aggregates stop competing with chat, tips and viewer counts on the primary.
Code: `lib/db/replica.ts`.

> **Status: routing shipped, replica not provisioned.** Until
> `POSTGRES_REPLICA_URL` is set, every query runs on the primary exactly as
> before, so this code is safe to deploy first. Provisioning needs Neon
> console or API access (below) and was not possible from the repository.

## Topology

```
                      ┌──────────────── Vercel functions ────────────────┐
  chat, tips, viewer  │  sql`...`  (@vercel/postgres, POSTGRES_URL)      │──► Neon primary (read-write)
  counts, all writes  │                                                  │        │ WAL via safekeepers
                      │  readFromReplica(label, sql => sql`...`)         │        ▼
  analytics, reports ─┤    healthy + caught up ──────────────────────────│──► Neon read replica (read-only,
                      │    unconfigured / recent write / breaker open /  │     same storage)
                      │    lagging ──► primary (bounded, see below)      │
                      └──────────────────────────────────────────────────┘
```

Routing is opt-in per query. Only code wrapped in `readFromReplica()` can
reach the replica. Every other query keeps using `sql` from
`@vercel/postgres`, which is the primary. A write can only reach the replica
by being written inside a `readFromReplica` callback. The replica rejects it
(SQLSTATE 25006), and the router refuses to retry it on the primary, so the
mistake surfaces instead of being hidden.

## Provisioning (manual, one-time)

1. Neon console → the production project → branch `main` → **Add Read
   Replica** (or `neon branches add-compute <branch-id> --type read_only`).
   A Neon replica is a read-only compute on the same storage as the primary,
   so no data copy is needed.
   (<https://neon.com/docs/introduction/read-replicas>)
2. **Connect** → Compute: the replica → enable **Connection pooling** → copy
   the connection string. Its host contains `-pooler.`.
   (<https://neon.com/docs/guides/read-replica-guide>)
3. In Vercel → Project → Settings → Environment Variables, add
   `POSTGRES_REPLICA_URL` = that pooled string, for Production (and Preview if
   wanted). Redeploy.
4. Check the logs: requests to replica-routed routes log
   `{"message":"db.read","target":"replica",...}`. If
   `db.replica.misconfigured` appears, the URL is not a pooled string
   (`@vercel/postgres` only accepts pooled URLs); routing stays on the primary.
5. Validate the lag probe (next section) on the real replica before relying
   on the lag threshold.

Cost: the replica is an extra compute billed like the primary's. It can
autoscale and scale to zero like any Neon compute.

## Environment variables

| Variable                          | Default   | Meaning                                                                                         |
| --------------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `POSTGRES_REPLICA_URL`            | unset     | Pooled connection string of the read replica. Unset or blank means everything uses the primary. |
| `DB_REPLICA_MAX_LAG_SECONDS`      | `30`      | Reads fall back when the replica is further behind than this.                                   |
| `DB_READ_YOUR_WRITES_SECONDS`     | = max lag | How long after a user's write their replica-routed reads use the primary.                       |
| `DB_REPLICA_FALLBACK_CONCURRENCY` | `4`       | Per-instance cap on fallback reads running on the primary at once.                              |
| `DB_REPLICA_BREAKER_THRESHOLD`    | `3`       | Consecutive replica failures that open the circuit breaker.                                     |
| `DB_REPLICA_BREAKER_COOLDOWN_MS`  | `30000`   | How long the breaker stays open before the replica is retried.                                  |
| `DB_REPLICA_LAG_PROBE_TTL_MS`     | `5000`    | How long a lag measurement is reused per instance.                                              |
| `DB_REPLICA_QUERY_TIMEOUT_MS`     | `5000`    | A replica query slower than this counts as a failure and falls back.                            |
| `DB_SLOW_QUERY_MS`                | `500`     | Routed queries at or above this log `db.slow_query`.                                            |

Malformed numbers fall back to the defaults.

## Routing rules

For each `readFromReplica(label, run, { request })` call, in order:

| #   | Condition                                                         | Target           | Log                                                      |
| --- | ----------------------------------------------------------------- | ---------------- | -------------------------------------------------------- |
| 1   | No replica configured                                             | primary          | `db.read` reason `unconfigured`                          |
| 2   | Caller wrote within `DB_READ_YOUR_WRITES_SECONDS` (cookie)        | primary          | reason `recent-write`                                    |
| 3   | Circuit breaker open                                              | bounded fallback | `db.replica.fallback` reason `breaker-open`              |
| 4   | Replica lag > `DB_REPLICA_MAX_LAG_SECONDS`, or lag unknown        | bounded fallback | `db.replica.lag_exceeded`, then fallback reason `lag`    |
| 5   | Otherwise                                                         | replica          | reason `healthy`                                         |
| 5a  | …and the replica fails with a connection-level error or times out | bounded fallback | `db.replica.error`, then fallback reason `replica-error` |

### Consistency and read-your-own-writes

The replica is asynchronous and eventually consistent. A replica-routed read
may be up to `DB_REPLICA_MAX_LAG_SECONDS` behind, and is usually far less.

The user's own writes are the exception. A write handler whose data feeds a
replica-routed read for the same user calls `markRecentWrite(response)`. That
sets an httpOnly cookie (`sf_recent_write`, lifetime
`DB_READ_YOUR_WRITES_SECONDS`), and while it is present that user's routed
reads go to the primary. The window equals the maximum tolerated lag, so a
user always sees their own write.

- The cookie carries only the write's timestamp, HMAC-signed with
  `SESSION_SECRET` (`lib/auth/sign-token.ts`). It grants no access; it only
  selects which database serves the caller's own reads. It is signed because
  an unsigned marker would let any client pin all its reads to the primary,
  including during a replica incident, which bounded fallback exists to
  prevent. Unsigned, edited, expired or future-dated markers are ignored.
  Without `SESSION_SECRET` no marker is issued or honoured.
- The browser does not cache these responses either: the per-user analytics
  routes use the `privateAnalytics` policy (`private, no-cache`), so a
  refetch after a write actually reaches the server (`docs/caching-policy.md`).
- Writes that do not come from the user's browser (Mux webhooks, crons) cannot
  set the cookie. Data they write shows up on the replica within the lag
  window. Classification below.

### Lag measurement

Measured on the replica, cached for `DB_REPLICA_LAG_PROBE_TTL_MS` per
instance. Concurrent requests share one probe.

```sql
SELECT CASE
  WHEN NOT pg_is_in_recovery() THEN 0
  WHEN pg_last_wal_receive_lsn() IS NOT NULL
   AND pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn()
   AND EXISTS (SELECT 1 FROM pg_stat_wal_receiver
               WHERE status = 'streaming'
                 AND last_msg_receipt_time > now() - make_interval(secs => $max_lag))
   THEN 0
  ELSE EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp())
END AS lag_seconds
```

- `now() - pg_last_xact_replay_timestamp()` alone grows while the primary is
  idle, even though the replica is fully caught up. The LSN equality check
  reports 0 in that case.
- "Replayed everything received" proves nothing if the WAL stream has
  stalled. The receiver keeps reporting `streaming` until
  `wal_receiver_timeout` (60s by default), so the check also requires a
  message from the primary within the lag threshold. A healthy idle stream
  exchanges status messages about every 10s; the lab measured a receipt
  age of 2.5–13.7s.
- In the lab, with the replica's network cut, the probe reported 0 for
  about 30s, then 35.1s and 45.7s. Reads fell back from then on. After
  reconnecting it returned to 0.
- A NULL result (lag cannot be determined) counts as unhealthy.

**Validate after provisioning.** These are standard Postgres standby
functions. Neon documents lag through its Monitoring graphs ("Replication
delay seconds/bytes") and does not document these functions for its
replicas. Run the query on the replica while the primary is idle and while
it is writing, and compare with the Monitoring graph. If Neon returns NULL
for `pg_last_wal_receive_lsn()` and an idle primary makes the lag look high,
routed reads fall back while the primary is quiet. That is harmless for load,
since the primary is idle, but it defeats the routing, so set
`DB_REPLICA_MAX_LAG_SECONDS` accordingly.

### Replica failure and fallback

Fallback runs the read on the primary, but only while fewer than
`DB_REPLICA_FALLBACK_CONCURRENCY` fallback reads are in flight on that
instance. Beyond that the read fails with `ReplicaUnavailableError`, and the
route returns `503` with `Retry-After: 30`
(`{"error": "Analytics temporarily unavailable, please retry shortly"}`).

The trade-off is deliberate. Unbounded fallback would move all analytics
load onto the primary at the worst moment, when the replica is down or
lagging because something is already wrong. Bounded fallback keeps
dashboards working for light traffic during a replica incident and sheds
the rest.

- **Circuit breaker.** After `DB_REPLICA_BREAKER_THRESHOLD` consecutive
  connection-level failures, the replica is skipped for
  `DB_REPLICA_BREAKER_COOLDOWN_MS`, so every request stops paying a timeout.
  After the cooldown the next request tries the replica again, and one
  success closes the breaker.
- **What counts as a replica failure** (retried on the primary): SQLSTATE
  class 08 (connection), 57P01/57P02/57P03 (shutdown or starting up), 53300
  (too many connections), 40001/40P01 "conflict with recovery", Node socket
  errors (`ECONNREFUSED`, …), connection-closed messages, and the
  query timeout.
- **What does not count** (thrown to the route): query errors such as a
  missing column. These would fail the same way on the primary, and
  retrying them would double the load. 25006 (a write reached the replica)
  is also rethrown.
- **Per-instance state.** Breaker, lag cache and fallback counter live in
  each serverless instance. No shared store sits on the read path. The
  worst-case fallback load on the primary is `instances ×
DB_REPLICA_FALLBACK_CONCURRENCY`.

## Observability

Every routed query emits one JSON log line through `lib/tracing/logger`,
carrying the request's trace id. No SQL text or parameters are logged.

| Question                                 | Log query (Vercel logs / log drain)                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| Which database served a query?           | `db.read` / `db.slow_query` → `target` (`primary`/`replica`), `reason`, `label` |
| Are analytics leaving the primary?       | share of `db.read` with `target:"replica"` per `label`                          |
| How often does fallback happen?          | count of `db.replica.fallback` by `reason`                                      |
| How often is fallback refused (503)?     | count of `db.replica.fallback_rejected`                                         |
| Replica latency                          | `durationMs` of `db.read` where `target:"replica"`                              |
| How often is the replica too far behind? | count of `db.replica.lag_exceeded` (`lagSeconds`)                               |
| Breaker trips                            | `db.replica.breaker_open`                                                       |
| Misconfiguration                         | `db.replica.misconfigured`                                                      |

`db.read` is logged at debug level and everything else at warn or error.
Neon's Monitoring page shows the replica's own CPU, connections and
replication delay.

## Query classification

Every analytics, reporting, stats and dashboard route was audited. Routes that
build their data from seed or in-memory stores (no SQL) are listed at the end.

**Replica-eligible:** read-only, and a lag of up to `DB_REPLICA_MAX_LAG_SECONDS` is acceptable.

| Route                                              | Label                                     | Notes                                                                                                                          |
| -------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/routes-f/analytics-daily-followers`      | `routes-f.analytics-daily-followers`      | `ensure*()` DDL stays on the primary; SELECTs routed                                                                           |
| `GET /api/routes-f/analytics-daily-viewers`        | `routes-f.analytics-daily-viewers`        | same                                                                                                                           |
| `GET /api/routes-f/analytics-daily-stream-minutes` | `routes-f.analytics-daily-stream-minutes` | same                                                                                                                           |
| `GET /api/routes-f/analytics-top-clips`            | `routes-f.analytics-top-clips`            | same                                                                                                                           |
| `GET /api/routes-f/analytics-viewer-geo`           | `routes-f.analytics-viewer-geo`           | Viewer rows are written by other users, so no RYOW is needed                                                                   |
| `GET /api/admin/analytics`                         | `admin.analytics.counts`                  | Loaded into a 30s Redis entry shared by every admin (`adminAggregate`), so it is ≤30s stale by design and has no per-user RYOW |

**Conditional (read-your-own-writes):** replica by default, primary for
`DB_READ_YOUR_WRITES_SECONDS` after the caller's own relevant write.

| Route                                                                                           | Label                                                 | Writes that set the marker                                       |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| `GET /api/routes-f/analytics-daily-revenue`                                                     | `routes-f.analytics-daily-revenue`                    | `POST` on the same route                                         |
| `GET /api/routes-f/analytics-top-tippers`                                                       | `routes-f.analytics-top-tippers`                      | `POST /api/tips/refresh-total`                                   |
| `GET /api/routes-f/analytics-session-list`, `…/analytics-session-detail`, `…/creator/analytics` | `routes-f.analytics-session-*`, `creator.analytics.*` | `POST`/`DELETE /api/streams/start`, `DELETE /api/streams/delete` |
| `GET /api/routes-f/donations/history`                                                           | `routes-f.donations-history`                          | `POST /api/tips/send`, `POST /api/routes-f/tip-confirm`          |

Data written without a user request (Mux webhooks `webhooks/mux`,
`routes-f/webhooks-mux-live`; `routes-f/webhooks-stellar-payment`; cron
`routes-f/cron-close-inactive-sessions`) reaches these routes within the lag
window. So do writes by one user that feed another user's analytics
(`streams/viewers`, `streams/chat`).

**Primary-required.**

| Route / code                                                           | Why                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/routes-f/tip-recap`                                          | One primary-key lookup behind a public share link. On the replica, a tip shared seconds after it was sent could 404 within the lag window, and routing it saves nothing |
| `GET /api/users/[username]/stats`                                      | Read immediately after `tips/refresh-total` by `TipCounter`, and a single primary-key lookup, so routing saves nothing                                                  |
| `GET /api/routes-f/activity` (+ `/daily`)                              | Runs `CREATE TABLE IF NOT EXISTS` on every read, and is a feed rather than an aggregate. Revisit once the DDL moves to a migration                                      |
| `routes-f/cron-refresh-materialized-views`                             | `REFRESH MATERIALIZED VIEW` is a write                                                                                                                                  |
| `lib/analytics/concurrent-viewers.ts`                                  | Reads and writes `concurrent_viewer_cache` together                                                                                                                     |
| `streams/viewers`, all POST/PATCH/DELETE handlers, all `ensure*()` DDL | Writes                                                                                                                                                                  |
| Chat, stream browse/detail, tips, whitelist, notifications             | Latency-sensitive or must reflect the latest write                                                                                                                      |

**No database access (seed or in-memory):** `analytics-chat-engagement`,
`analytics-export-csv`, `analytics-viewer-devices`, `stream-analytics`,
`creator-dashboard`, `routesF/analytics-recap`, `tip-heatmap`, `top-tippers`,
`tips/recent`, `tip-goal-history`, `routesF/follower-churn-analysis`,
`peer-benchmark-comparison`, `tips-per-viewer`, `creator-export`.

### Adding a route

1. Authenticate and validate before the callback. Run any DDL before it too,
   since DDL must stay on the primary. Ownership checks that need a lookup
   may run inside it, in the same order as before. Never write inside it.
2. Wrap the SELECTs (use `db.query(text, params)` for SQL built at runtime):
   ```ts
   const rows = await readFromReplica(
     "area.route.query",
     db => db`SELECT …`.then(r => r.rows),
     { request: req }
   );
   ```
3. In the catch: `if (error instanceof ReplicaUnavailableError) return replicaUnavailableResponse();`
4. If the route shows the caller's own writes, add `markRecentWrite(response)`
   to those write handlers.
5. Never cache the response publicly (`public`/`s-maxage`) if it is
   per-user. `__tests__/api/analytics-replica-routing.test.ts` asserts this
   for every routed route.

## Load test

See `docs/database/query-performance.md` → "Primary vs replica contention".
