# Query performance audit and index review

This page covers the first systematic query and index audit (issue #1415), what
it changed, and the process for repeating it. The tooling lives in
`scripts/perf/`, and its README has the run instructions. The index changes are
in `db/migrations/20260926100200_hot_path_indexes.sql`.

Upstream PR #1640 (#1410) shipped `20260925190000_chat_poll_indexes.sql` while
this audit was running. That migration adds `idx_users_mux_playback_id`,
`idx_stream_sessions_open_by_user` and `idx_chat_messages_session_window`. The
lab measured the same three candidates independently; the rows below credit
them to that migration, and this change does not add them again.

## What evidence this audit is based on

| Source                                                                                                 | Used?                                                                      |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Production `pg_stat_statements`, slow-query logs, Neon metrics                                         | **No, not available to this change.** No production credentials were used. |
| Code audit of every route's SQL: frequency from client polling intervals, filters, ordering            | Yes. This is how the hot paths were chosen.                                |
| `EXPLAIN (ANALYZE, BUFFERS)` against a Postgres 16 lab with synthetic data shaped like the worst cases | Yes. Every number below comes from it.                                     |

The hot-path ranking below is inferred from code, not measured in production.
The chat routes are polled every second per viewer (`hooks/useChat.ts`), the
notification bell every 30 seconds, and the profile page every 30 seconds.
Everything else is loaded per page view. Step 1 of the process below replaces
this inference with measured data once someone with production access runs
`scripts/perf/query-audit.sql`.

### Dataset

Reduced scale because of disk limits on the reference machine (full-scale
knobs are in `seed-synthetic.sql`): 200k users (2k live), 1M stream sessions
(2k active, heavy streamers with ~2.5k each), 3.5M chat messages (20 hot
sessions × 100k, with deliberate timestamp ties), 400k viewers, 100k clips,
100k recordings, 150k whitelist rows (streamers with 5k), and 300k
notifications (users with 20k). About 1.7 GB in total. Plans are measured
warm (third of three runs).

**Limitations.** The data is synthetic, on a single Docker host, and not Neon.
Read the results as which plan the planner chooses and how many buffers it
touches. The buffer counts carry over to production better than the
milliseconds do. See `scripts/perf/README.md` → Limitations.

## Findings

### The known functional-index inconsistency

This one is confirmed and fixed. Two different indexes share the name
`idx_users_username`: `db/schema.sql` defines it on plain `username`, and
`scripts/optimize-database.sql` defines it on `LOWER(username)`. Both use
`CREATE INDEX IF NOT EXISTS`, so whichever file ran first won and the other
was silently skipped. About 30 query sites filter on
`LOWER(username) = LOWER($1)`. With the plain definition, which is also an
exact duplicate of the `UNIQUE(username)` constraint index, every one of them
sequentially scans `users`. That is 58.6 ms and 7,587 buffers at 200k users.

The same pattern affects `LOWER(wallet)`. `docs/stellar-wallet-migration.md`
says it was removed, yet about 10 query sites still use it, with no index to
serve them. It also affects `LOWER(email)` on the auth path.
`idx_users_is_live` has three competing definitions and was left alone (see
"Not changed").

The migration creates `idx_users_username_lower` first, then drops
`idx_users_username`. Whichever definition production has, the end state is
deterministic. `scripts/optimize-database.sql` now uses the new name.

### Before and after

Execution ms and shared buffers, worst-case parameters:

| Query (route)                                                   | Before                                                                                     | After            | Index                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------ |
| Chat, current query (`streams/chat` GET, polled 1/s per viewer) | 1,390.9 ms, 890k buf. Backward scan of `idx_chat_messages_created_at` discarding 886k rows | 13.1 ms, 818 buf | chat keyset index (lab); ships as `idx_chat_messages_session_window`     |
| Chat keyset, first page (new query)                             | 1,275.7 ms, 890k buf                                                                       | 5.6 ms, 822 buf  | same                                                                     |
| Chat active-session lookup (every poll)                         | 43.5 ms, 10,113 buf. Parallel seq scan on `users`                                          | 0.27 ms, 10 buf  | `idx_users_mux_playback_id` + `idx_stream_sessions_open_by_user` (#1640) |
| `LOWER(username)` lookup                                        | 58.6 ms, seq scan                                                                          | 0.09 ms, 4 buf   | `idx_users_username_lower`                                               |
| `LOWER(wallet)` lookup                                          | 79.3 ms, seq scan                                                                          | 0.06 ms          | `idx_users_wallet_lower`                                                 |
| `LOWER(email)`, no match (first login)                          | 157.9 ms, seq scan                                                                         | 0.07 ms          | `idx_users_email_lower`                                                  |
| Clips, global keyset                                            | 53.7 ms, parallel seq scan + sort                                                          | 3.8 ms, 188 buf  | `idx_stream_clips_ready_keyset`                                          |
| Clips by streamer                                               | 70.7 ms                                                                                    | 10.6 ms          | `idx_users_username_lower` + `idx_stream_clips_streamer_ready_keyset`    |
| Recordings owner list (`recordings/[wallet]`)                   | 89.3 ms                                                                                    | 12.2 ms          | `idx_users_wallet_lower` + `idx_stream_recordings_user_keyset`           |
| Whitelist, 5k-entry streamer                                    | 9.5 ms, bitmap scan + sort                                                                 | 1.0 ms           | `idx_stream_whitelist_streamer_keyset`                                   |
| Notifications page / unread count                               | 0.08 / 0.26 ms                                                                             | same             | indexes created with the new table                                       |

The worst finding is the chat poll. The old query ordered by `created_at`
alone, so the planner walked the global `created_at` index backwards and
discarded every other session's messages. Its cost grows with the whole
table, not with the session. A per-session index makes it proportional to the
page.

**Chat index: one index, not two.** The lab first built a full keyset index,
`(stream_session_id, created_at DESC, id DESC)`. It was then measured against
upstream's `(stream_session_id, created_at DESC)` on the same hot session:

Warm; third of three runs; the other index hidden in a rolled-back
transaction:

| Page                                | Window index (#1640)                                                      | Keyset index         |
| ----------------------------------- | ------------------------------------------------------------------------- | -------------------- |
| First page, 201 rows                | 1.16 ms, 635 buffers (incremental sort on `id` within 6 timestamp groups) | 1.51 ms, 629 buffers |
| Deep cursor, 60k rows back, 51 rows | 0.33 ms, 171 buffers                                                      | 0.14 ms, 164 buffers |

The planner derives `created_at <= $ts` from the `(created_at, id)` row
comparison, so the window index already bounds a deep page to the page
itself. What remains is an in-memory sort of tied rows. A second 193 MB
index on the most write-heavy table is not worth that, so it was dropped
from this change.

Timestamp ties were checked directly (`scripts/perf/keyset-ties-check.sql`).
Paging a hot session with the `(created_at, id)` cursor returned all 98,000
rows exactly once. A `created_at`-only cursor, which is what the old chat
code attempted, lost 266 rows.

### Index changes

**Added.** Sizes are at lab scale. Every index is built `CONCURRENTLY`, and
all built in under 8 s in the lab.

| Index                                                                         | Size         | Serves                       |
| ----------------------------------------------------------------------------- | ------------ | ---------------------------- |
| `idx_users_username_lower`                                                    | 6–17 MB      | ~30 `LOWER(username)` sites  |
| `idx_users_wallet_lower`                                                      | 6–17 MB      | ~10 `LOWER(wallet)` sites    |
| `idx_users_email_lower`                                                       | 6–17 MB      | auth email lookups           |
| `idx_stream_clips_ready_keyset`, `…_streamer_ready_keyset` (partial, `ready`) | 3.2 / 4.6 MB | clips pages                  |
| `idx_stream_recordings_user_keyset`                                           | 5.8 MB       | recordings pages, owner list |
| `idx_stream_whitelist_streamer_keyset`                                        | 8.6 MB       | whitelist pages              |

**Dropped as redundant.** Each drop runs after its replacement exists.

| Index                                   | Why                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idx_chat_messages_not_deleted` (72 MB) | Left prefix of `idx_chat_messages_session_window` (#1640), with the same predicate. `chat_messages` is write-heavy, so one fewer index on every insert. |
| `idx_users_username`                    | Duplicate of `users_username_key`, or of the new `LOWER` index if production built the other definition                                                 |
| `idx_users_wallet` (22 MB)              | Duplicate of `users_wallet_key`                                                                                                                         |
| `idx_stream_recordings_user_id`         | Left prefix of the new keyset index                                                                                                                     |
| `idx_stream_whitelist_streamer`         | Left prefix of two unique indexes and the new keyset index                                                                                              |

### Rejected after measurement

| Candidate                                                    | Result                                                                                                                                                                                                                                  | Decision                                                                                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `users (current_viewers DESC) WHERE is_live` for live browse | Page 1: 4.5 → 0.5 ms. Deep pages: no gain. `current_viewers` UPDATEs went from ~96% HOT to 0% HOT, with ~3× WAL per update (481 → 1,531 bytes) and 712 KB of index growth per minute instead of 16–56 KB. Same HOT result in both runs. | **Rejected.** Viewer counts are among the most frequent writes on the platform. Cheaper reads on one page are not worth it.    |
| `users (is_banned)` for the admin total-users count          | 51 → 28 ms, and only via an index-only scan that needs an all-visible heap. 99% of rows match.                                                                                                                                          | **Rejected.** Low selectivity on an admin-only endpoint, which now reads from the replica anyway.                              |
| Partial `stream_recordings` keyset `WHERE status = 'ready'`  | `recordings/[wallet]` lists all statuses                                                                                                                                                                                                | **Rejected** in favour of the plain keyset index, which serves both routes.                                                    |
| Index for `LOWER(title)` on `stream_categories`              | 8 rows                                                                                                                                                                                                                                  | **Rejected.** A sequential scan is optimal, and the table is now cached (docs/caching-policy.md → Reference data at the edge). |
| Indexes for admin `COUNT(*)` / viewer-geo aggregates         | Already use indexes where selective; remaining cost is aggregation                                                                                                                                                                      | **Not indexed.** Moved to the read replica (docs/database/read-replicas.md).                                                   |

### Not changed, with follow-ups

- **`idx_users_is_live`** has three definitions under one name (`db/schema.sql`,
  `optimize-database.sql`, `api/debug/fix-db`). Check production with
  `SELECT indexdef FROM pg_indexes WHERE indexname IN ('idx_users_username', 'idx_users_is_live');`
  before changing it.
- **Clips and recordings filtered by username** still sort about 1,800 rows
  (~10 ms), because the join form hides the per-user keyset order from the
  planner. Resolving the user id first with a scalar subquery gets 0.5–0.7 ms.
  It was not applied: `LOWER(username)` can match more than one user
  (`UNIQUE(username)` is case-sensitive), and the rewrite would change
  results for that case.
- **`GET /api/users/top`** runs a per-user `COUNT(user_follows)` over all users.
  That is an aggregation problem, not an index problem (materialize or cache
  it).
- **Schema drift found during the audit:** `tips` and
  `users.stellar_public_key` (used by `tips/send`) and the three materialized
  views refreshed by `cron-refresh-materialized-views` are not defined in any
  SQL file in the repo.

## Primary vs replica contention

Load test in the same lab. The primary and the replica each have 4 pinned
cores. Chat is one viewer poll (active-session lookup plus keyset first page)
with 32 clients. Analytics is the admin counts plus viewer geo, with 8
clients. There is a light chat-insert load on the primary. 60 s per scenario.
Run 2 is authoritative (see `scripts/perf/README.md` for why run 1's write
latencies are harness artefacts).

| Scenario                      | Chat TPS | Chat p50 / p95 / p99 ms | Analytics TPS | Replay lag avg / max |
| ----------------------------- | -------: | ----------------------: | ------------: | -------------------: |
| S1 chat only                  |      401 |          63 / 198 / 289 |             – |                    – |
| S2 + analytics on the primary |      233 |         113 / 330 / 464 |           2.6 |          99 / 279 ms |
| S3 + analytics on the replica |      335 |          77 / 239 / 348 |           7.7 |       201 / 1,409 ms |

With analytics on the primary, chat throughput fell 42% and p95 rose 67%.
With analytics on the replica, most of that was recovered (−16% TPS, +21%
p95 vs chat alone). The analytics themselves ran about 3× faster on the
replica's own cores. The standby recorded no recovery conflicts. The
remaining gap comes from the shared host (disk and memory bandwidth) and
from WAL shipping.

Neon replicas share storage with the primary rather than replaying WAL into
their own copy, so these lag figures do not transfer. The contention result
(CPU-heavy reads moved off the primary compute) does. Verify on Neon after
provisioning (docs/database/read-replicas.md).

## Repeatable process

**Cadence.** Monthly, and after any release that adds or changes a
query on a route polled faster than once per minute. Also run it whenever
a threshold below is crossed.

1. **Find hot queries in production.** With the owner role, enable
   `pg_stat_statements` once (`CREATE EXTENSION IF NOT EXISTS
pg_stat_statements;`; Neon preloads the library). Then run
   `psql "$POSTGRES_URL" -X -f scripts/perf/query-audit.sql`. The script is
   read-only. It reports:
   - top statements by total time, mean time and calls;
   - tables with high sequential-scan counts;
   - unused, invalid and duplicate indexes;
   - index sizes.

   Neon resets these statistics when the compute restarts or scales to zero,
   so note the window the numbers cover.

2. **Also check the application logs.** Queries routed through
   `lib/db/replica.ts` log `db.slow_query` at or above `DB_SLOW_QUERY_MS`
   (default 500 ms), with label, target database and duration.
3. **Reproduce.** Copy the statement into `scripts/perf/hot-queries.sql` using
   the route's real SQL, and pick worst-case parameters: the largest tenant
   and a deep cursor. Seed the lab at a scale that matches production row
   counts (`seed-synthetic.sql` knobs).
4. **Get the plan.** Run `scripts/perf/run-explain.sh before`. It runs each
   query 3× and keeps the warm run. Look for:
   - sequential scans on large tables;
   - `Rows Removed by Filter` far above rows returned;
   - sorts of many rows feeding a small `LIMIT`;
   - estimated rows far from actual rows (run `ANALYZE`, or add an expression
     index so the planner gets statistics for that expression).
5. **Evaluate a candidate index** with `scripts/perf/candidates.sql` and
   `attribution.sql`, which hides one index inside a rolled-back
   transaction to attribute the gain. Record:
   - before and after time and buffers;
   - build time and size;
   - write cost on write-heavy tables (`run-loadtest.sh hot` pattern: TPS,
     HOT ratio, WAL bytes per update);
   - whether an existing index already has the same leading columns.

   Composite column order must follow the query: equality columns first,
   then the ORDER BY columns in the same direction.

6. **Decide and record it.** Add the index to a new
   `db/migrations/YYYYMMDD_*.sql`, using `CREATE INDEX CONCURRENTLY IF NOT
EXISTS`, one statement per line, with a comment giving the query and its
   before → after numbers. Record rejected candidates in the migration header
   and in this document.
7. **Apply safely.** Run `psql` outside a transaction and check for invalid
   indexes afterwards (query in the migration header). Then run `ANALYZE` on
   tables that got expression indexes.
8. **Verify in production.** Re-run step 1 a week later:
   - `idx_scan` of each new index should be greater than 0;
   - the statement's mean time should have dropped;
   - no new unused indexes should have appeared.

**Thresholds that trigger an investigation**

| Signal                                                         | Threshold                  |
| -------------------------------------------------------------- | -------------------------- |
| A statement's share of total DB time (`pg_stat_statements`)    | > 10%                      |
| Mean time of a statement on a route polled ≤ 1/min             | > 20 ms                    |
| Mean time of any other user-facing statement                   | > 100 ms                   |
| `db.slow_query` log lines for one label                        | > 1% of that label's reads |
| `seq_scan` on a table over 100k rows while `idx_scan` is lower | any                        |
| Index with `idx_scan = 0` for 30 days (not unique or PK)       | candidate for removal      |
| Invalid index                                                  | fix immediately            |
