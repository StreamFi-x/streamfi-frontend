# Postgres pooling and chat polling load

Audit, measurements and the realtime decision for #1410. Nothing here was
run against production. The numbers come from a local benchmark whose
limits are listed below. Treat them as relative evidence, not as a
production capacity figure.

## How the app talks to Postgres

| Path                                      | Where                                        | Transport                                                          | Connection behaviour                                                                                        |
| ----------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `` sql`…` `` from `@vercel/postgres` 0.10 | ~226 call sites                              | Neon HTTP driver (`neon()`), one HTTPS request per statement       | Holds no connection between statements. The pooler lends a server connection only while the statement runs. |
| `sql.query()`, `db.connect()`             | 4 `sql.query` sites, `lib/postgres-transaction.ts` | Neon WebSocket `Pool`, one per serverless instance, created lazily | Client connections to the pooler; a server connection only for the duration of a transaction                |
| `createClient()`                          | was `routes-f/profile-panels-upsert`         | Direct connection to `POSTGRES_URL_NON_POOLING`                    | One real Postgres backend per request, counted against `max_connections`. **Removed.**                      |
| Scripts (`scripts/*.js`, `*.mjs`)         | ops only                                     | Neon `Pool` on `DATABASE_URL`                                      | Not on the request path                                                                                     |

- `createPool()` refuses any `POSTGRES_URL` without `-pooler.` in the host
  (localhost excepted). Every `sql` call would throw otherwise, so a working
  deployment is already using the pooled endpoint. I could not read the
  deployed env vars to confirm this directly.
- Neon's pooler is PgBouncer in transaction mode. Its `default_pool_size`
  follows the compute size and cannot be configured from this repo.
  Transaction mode rules out session state across transactions (`SET`,
  `LISTEN`, session-level prepared statements). No request path relies on
  any of that.
- The HTTP path has no client-side `max`, idle timeout or connection timeout
  to tune, and it carries almost all queries.

### Fixes made

- **Fake transactions.** `routes-f/featured-streams-set` and
  `routes-f/stream/co-streamers/accept` sent `BEGIN`, the writes and
  `COMMIT` as separate HTTP requests that share no connection, so the writes
  were never atomic and `ROLLBACK` had nothing to roll back.
  Both now use `withTransaction()`.
- **Direct connection per request.** `profile-panels-upsert` opened a
  non-pooled connection for every request. It now uses `withTransaction()`,
  which checks out one pooled client and releases it, discarding it if
  `ROLLBACK` fails.
- Chat poll `limit` was unbounded (`?limit=1000000` was honoured). It is now
  clamped to 1..200 (default 50).

## Chat polling, as implemented

`hooks/useChat.ts` runs SWR with `refreshInterval: 1000` while the stream is
live, `dedupingInterval: 500`, and the key
`/api/streams/chat?playbackId=…&limit=200`. SWR does not start a poll while
the previous one is in flight, so a slow response lowers the rate instead of
stacking requests. Every poll returns the full newest-200 window. There is
no cursor for "messages since X".

Before this change, each poll ran two queries on the origin: the open-session
lookup, then the message window joined to `users`. Nothing was shared
between viewers:

```
DB polls/s = concurrent viewers on all live streams   (2 queries per poll)
```

After it, identical polls are collapsed twice: by the edge
(`public, s-maxage=1, stale-while-revalidate=1`) and by a 1-second
per-instance cache with single-flight loading. Load now scales with live
streams, not viewers:

```
DB polls/s ≈ live streams × (edge regions filling the cache + instances that miss)
```

`app/api/streams/chat/__tests__/route.test.ts` checks the in-process half:
50 concurrent polls of one stream cause exactly one load (2 queries), and the
next load happens after the 1s window. The edge half relies on Vercel honouring
`s-maxage`, which other routes here already depend on. It can be observed with
`scripts/load-test/chat-poll-http.mjs` (the `edge_served` column).

## Benchmark

Tooling, all in `scripts/load-test/`:

- `chat-seed.sql`: 50k users, 200 live streams (one with a 20k-message chat,
  the others 500 each), 20k ended sessions. 320k messages in total.
- `chat-poll.pgbench`: one poll, i.e. the route's two statements.
- `run-chat-db-bench.sh`: offers `VIEWERS` polls/s (open-loop, `pgbench -R`)
  through a fixed pool and reports achieved rate, latency (including queueing)
  and failures.
- `chat-poll-indexes.sql`: the candidate indexes. They shipped as
  `db/migrations/20260925190000_chat_poll_indexes.sql`.
- `chat-poll-http.mjs`: end-to-end viewers against a preview or staging URL.
  It refuses the production domain.

```sh
docker run -d --name bench-pg --tmpfs /var/lib/postgresql/data -e POSTGRES_PASSWORD=pw \
  -p 5432:5432 postgres:16-alpine -c max_connections=100
psql "$BENCH_DATABASE_URL" -f scripts/load-test/chat-seed.sql
BENCH_DATABASE_URL=… sh scripts/load-test/run-chat-db-bench.sh 20 1 15   # pool, pbmax, seconds
```

**Environment and limits:** Docker `postgres:16-alpine` on Windows 11 (WSL2),
16 vCPU and 20 GB shared with the host, data on tmpfs, `max_connections=100`,
`shared_buffers=128MB`. pgbench runs in the same container and competes for
CPU, which makes the numbers pessimistic. There is no network RTT, no Neon
compute and no PgBouncer: a fixed pgbench client pool stands in for the
pooler's server pool. Neon compute sizes differ, so read these numbers as
_relative_.

### Results

Every viewer is on the one busy stream (worst case). Pool of 20. 15s per step.
Latency in ms includes time spent queueing behind the schedule.

Without the new indexes (the schema as it is today):

| offered polls/s | achieved  | avg   | p95   | p99   |
| --------------- | --------- | ----- | ----- | ----- |
| 100             | 97        | 3.8   | 4.6   | 13.1  |
| 500             | 498       | 3.7   | 5.3   | 7.1   |
| 1,000           | 1,004     | 4.7   | 7.8   | 15.1  |
| 2,000           | 1,992     | 8.6   | 23.4  | 53.7  |
| 4,000           | **2,391** | 3,065 | 5,705 | 6,021 |

With `20260925190000_chat_poll_indexes.sql`:

| offered polls/s | achieved  | avg   | p95   | p99   |
| --------------- | --------- | ----- | ----- | ----- |
| 1,000           | 995       | 2.2   | 3.1   | 4.4   |
| 2,000           | 2,011     | 2.7   | 4.0   | 7.5   |
| 4,000           | **3,613** | 611   | 1,552 | 1,676 |
| 6,000           | 3,488     | 2,835 | 5,862 | 6,252 |

Viewers spread over 200 streams, with indexes: 2,000 polls/s sustained
(p95 6.5ms). Saturation at about 3,400–3,600 polls/s.

Why the indexes matter: without them the session lookup sequentially scans
every session ever recorded (it grows with history), and the window query
walks the global `created_at` index.

Pool size, with indexes, busy stream, 10s steps:

| pool | 2,000 polls/s p95 | 3,000 polls/s achieved / p95 |
| ---- | ----------------- | ---------------------------- |
| 5    | 1,275             | 2,151 / 3,520                |
| 20   | 4.0               | (saturates around 3,600)     |
| 50   | 6.2               | 2,988 / 55                   |
| 90   | 43.8              | 2,935 / 362                  |

The limit is database CPU, not connection count. Too few connections queue
work. Too many make tail latency worse through contention. **Raising
connection limits would not raise capacity.**

Opening connections directly past `max_connections` (pgbench `-c 120` against 100) fails with `FATAL: sorry, too many clients already`. That is the
connection-storm failure mode #1410 describes, and it would hit every route,
not only chat. The request path no longer has any direct connection that
could cause it.

**Rejected alternative:** folding the two statements into one CTE/LATERAL
query was 5× slower on the busy stream (9.6ms vs 1.9ms single-client, with
indexes). The planner cannot see the session id inside one statement, so it
assumes an average-sized chat, then bitmap-scans and sorts all 20k messages.
The route keeps two statements on purpose; there is a comment in the code.

## Decision

**Option A: keep polling, with coalescing and indexes.** Polling is not the
bottleneck once polls are collapsed per stream.

- Before: the database saw one poll per viewer per second. On the benchmark
  box that meant degradation from roughly 1,000–2,000 concurrent viewers
  _platform-wide_ and collapse near 2,400. A connection storm would take
  unrelated routes down with it.
- After: the database sees about one poll per live stream per region per
  second. For example, 200 concurrent live streams × 3 edge regions ≈ 600
  polls/s, about 17% of the indexed capacity measured here, whatever the
  viewer count.

A push-based rewrite (SSE, WebSockets, managed pub/sub) is not justified by
the measurements. On Vercel, SSE would also keep one function invocation open
per viewer and would still need a fan-out source, which transaction-mode
pooling and the HTTP driver cannot provide (`LISTEN`). That is a separate
project. `REALTIME_CONNECTION_MONITORING_SPEC.md` and
`lib/realtime/websocket-server-example.ts` cover that ground.

Revisit the decision when any of these holds:

1. Chat queries sustain more than 50% of the production compute's measured
   capacity. Re-run this benchmark against a branch database at the
   production compute size to get that number, then track chat query rate
   in Neon's `pg_stat_statements`.
2. `GET /api/streams/chat` p95 at the edge goes above 250ms, or its
   `x-vercel-cache` hit ratio falls below 80% during a large stream.
3. The product needs sub-second delivery, typing indicators or presence,
   which polling cannot provide at any cost.

## Deploying

1. `npm run db:migrate -- up` applies
   `db/migrations/20260925190000_chat_poll_indexes.sql`. It is marked
   `-- migrate:no-transaction` because `CREATE INDEX CONCURRENTLY` cannot run
   inside a transaction.
2. Deploy the application.

Order does not affect correctness. The code works without the indexes, just
slower.
