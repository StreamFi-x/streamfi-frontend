# StreamFi Postgres perf lab

A reproducible Docker lab for checking the hot-path SQL of the Next.js API against a
Postgres 16 primary + streaming hot standby, with synthetic data shaped like the worst
cases the routes hit (hot live sessions, heavy streamers, deep cursors).

Everything here is lab tooling. Nothing in this directory runs in the app.

## Files

| File                                | Purpose                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `lab-up.sh` / `lab-down.sh`         | Start (idempotent) / remove the lab containers, network and volumes                                             |
| `schema.sql`                        | Tables + baseline indexes derived from `db/schema.sql` and `db/migrations/*.sql` (patches listed in its header) |
| `seed-synthetic.sql`                | Deterministic `generate_series` data load, row counts set with `psql -v` knobs                                  |
| `hot-queries.sql`                   | The audited queries (Q1–Q12), copied from the route files, as `EXPLAIN (ANALYZE, BUFFERS)`                      |
| `hot-queries-variants.sql`          | Shape variants (scalar-subquery lookups, is_banned count, deep live page)                                       |
| `attribution.sql`                   | Re-plans a query with one candidate index hidden (`DROP INDEX` inside a rolled-back transaction)                |
| `candidates.sql`                    | Builds every candidate index `CONCURRENTLY`, timed, and prints sizes                                            |
| `keyset-ties-check.sql`             | Pages through a hot session with timestamp ties: tuple cursor vs `created_at`-only cursor                       |
| `run-explain.sh`                    | Runs a query file 3× and keeps run 3 (warm cache), plus a per-query summary                                     |
| `run-loadtest.sh`, `loadtest/*.sql` | pgbench scenarios S1–S3 and the `current_viewers` HOT-update test                                               |
| `query-audit.sql`                   | Read-only audit to run against production (pg_stat_statements, seq scans, unused / invalid / duplicate indexes) |

## Containers

| Name             | Role                                                                                                 | CPUs | Memory | Host port              |
| ---------------- | ---------------------------------------------------------------------------------------------------- | ---- | ------ | ---------------------- |
| `sfperf-primary` | postgres:16, `wal_level=replica`, `pg_stat_statements`, `track_io_timing=on`, `shared_buffers=512MB` | 0-3  | 4 GB   | 55462 (`PRIMARY_PORT`) |
| `sfperf-replica` | hot standby from `pg_basebackup -R`, slot `sfperf_replica`                                           | 4-7  | 4 GB   | 55463 (`REPLICA_PORT`) |
| `sfperf-client`  | pgbench / psql only                                                                                  | 8-11 | 2 GB   | none                   |

Password `sfperf`, database `streamfi`, network `sfperf-net`, volumes `sfperf-primary-data`
and `sfperf-replica-data`. The default ports avoid 55432 because another local container
already bound it on the reference machine; override with `PRIMARY_PORT` / `REPLICA_PORT`.

## Run it end to end

From the repo root, in Git Bash (the scripts set `MSYS_NO_PATHCONV=1` for `docker exec`):

```bash
export PERF_RESULTS=/tmp/sfperf-results            # where run-*.sh write their output

scripts/perf/lab-up.sh                              # ~20 s; checks pg_is_in_recovery() and a replicated write
docker exec -i sfperf-primary psql -U postgres -d streamfi -v ON_ERROR_STOP=1 < scripts/perf/schema.sql
docker exec -i sfperf-primary psql -U postgres -d streamfi -v ON_ERROR_STOP=1 \
  -v chat_ended_rows=500000 -v viewers_rows=400000 -v clips_rows=100000 -v recordings_rows=100000 \
  -v notif_heavy_users=10 -v notif_random_rows=100000 -v reports_rows=10000 \
  < scripts/perf/seed-synthetic.sql                 # reduced scale, ~7 min; omit the -v knobs for full scale

scripts/perf/run-explain.sh before                  # baseline plans
docker exec -i sfperf-primary psql -U postgres -d streamfi < scripts/perf/candidates.sql
scripts/perf/run-explain.sh after-all
scripts/perf/run-explain.sh attribution scripts/perf/attribution.sql
scripts/perf/run-explain.sh variants scripts/perf/hot-queries-variants.sql
docker exec -i sfperf-primary psql -U postgres -d streamfi < scripts/perf/keyset-ties-check.sql

scripts/perf/run-loadtest.sh hot                    # ~5 min: current_viewers UPDATE with/without idx_users_live_viewers
# apply the migration (drops the redundant indexes, keeps only the ADDs), then:
docker exec -i sfperf-primary psql -U postgres -d streamfi < db/migrations/20260926100200_hot_path_indexes.sql
scripts/perf/run-explain.sh after-final
scripts/perf/run-loadtest.sh S1 S2 S3               # ~4.5 min; WRITE_RATE (default 20) = chat INSERT tps in S2/S3

docker exec -i sfperf-primary psql -U postgres -d streamfi -X < scripts/perf/query-audit.sql

scripts/perf/lab-down.sh                            # removes containers, network and both volumes
```

Timings above are from the reference run (Windows 11, Docker Desktop 27, WSL2 backend).

`WRITE_RATE` must stay below what 4 write clients can sustain while the primary is busy.
The first reference run used 200 tps. The writers reached only 40-50 tps, and pgbench then
counted the growing `-R` schedule lag (avg 19.7 s) as write latency. Those write
latencies measure the harness backlog, not the database. With the default of 20 tps the
writers kept close to schedule (schedule lag avg 225 ms).

## Reference results (reduced scale, all ADD indexes applied, 60 s per scenario)

Chat = one viewer poll (Q2 active-session lookup + Q1b keyset first page), 32 clients on
the primary. Analytics = Q11 + Q12, 8 clients. Replica lag is sampled roughly once per second.

| Scenario                          | Chat TPS | Chat p50 / p95 / p99 ms | Analytics TPS (p50 ms) | Replay lag avg / max (ms) |
| --------------------------------- | -------: | ----------------------: | ---------------------: | ------------------------: |
| S1 chat only (run 2)              |      401 |          63 / 198 / 289 |                      - |                         - |
| S2 + analytics on primary (run 2) |      233 |         113 / 330 / 464 |             2.6 (2928) |                  99 / 279 |
| S3 + analytics on replica (run 2) |      335 |          77 / 239 / 348 |              7.7 (966) |                201 / 1409 |

Run 1 (WRITE_RATE=200) chat results: S1 467 tps, p50/p95/p99 58/152/251 ms; S2 313 tps,
80/267/430 ms; S3 373 tps, 69/219/331 ms. Its write latencies and replay-lag figures are not
usable (see above). In both runs, moving analytics to the replica recovered most of the chat
throughput that S2 lost. Analytics TPS also rose 2.6-3x, because the replica has its own 4 cores.
The standby recorded no recovery conflicts.

`current_viewers` UPDATE, 16 clients, run 2: 1715 tps and 95.7% HOT without
`idx_users_live_viewers`, 1231 tps and 0% HOT with it, 1737 tps and 96.7% HOT after
dropping it again. In run 1 the TPS order was reversed (1429 / 1587 / 1571), so treat the
TPS difference as noise-prone. The HOT ratio (97.3% / 0% / 97.7%) was the same in both runs.

## Scale and disk

The reference run used the **reduced** knobs shown above because the host's C: drive ran
down to ~4 GB free during the full-scale load (the full-scale load was cancelled while
inserting chat rows for ended sessions). Rows actually loaded:

| Table                            | Rows         | Notes                                                                |
| -------------------------------- | ------------ | -------------------------------------------------------------------- |
| users                            | 200,000      | 2,000 live, 2,000 banned, mixed-case usernames, `G…` 56-char wallets |
| stream_sessions                  | 1,000,000    | 2,000 active; 50 heavy streamers with ~2,500 sessions each           |
| chat_messages                    | 3,500,000    | 20 hot sessions × 100k with timestamp ties, 2% deleted               |
| stream_viewers                   | 400,000      |                                                                      |
| stream_clips / stream_recordings | 100,000 each | 80% ready                                                            |
| stream_whitelist                 | 150,000      | 20 streamers with 5,000 entries                                      |
| notifications                    | 300,000      | 10 users with 20,000 each                                            |
| stream_reports / bug_reports     | 10,000 each  |                                                                      |

Database size after the reduced load: 1.7 GB on the primary and the same on the replica,
plus up to ~1 GB of WAL on each (`max_wal_size=1GB`). Docker Desktop's WSL2 disk image
does not shrink when the volumes are removed; reclaiming host space needs a manual VHDX
compaction.

## Limitations

- **Synthetic data.** Distributions are hand-shaped (uniform timestamps, fixed skews,
  md5-derived ids). Real selectivities, correlations and hot-set sizes will differ, so read
  results as "which plan the planner picks and roughly how much work it does", not as
  production latencies. The buffer counts are more portable than the milliseconds.
- **Reduced scale.** The reference run is smaller than the full-scale targets (see above).
  Plans that depend on table size (for example the `idx_chat_messages_created_at`
  backward scan in the old chat query) get worse as tables grow, not better.
- **Single host, Docker.** Primary, replica and client share one machine, one disk and
  one kernel; CPU pinning isolates cores but not memory bandwidth or I/O. Windows +
  WSL2 adds timing noise, which is visible in repeated runs.
- **Not Neon.** Production is Vercel Postgres / Neon. Neon separates compute from
  storage: pages come from the pageserver instead of a local disk, cold reads cost more,
  and the compute can scale to zero (which also resets `pg_stat_statements`). Neon read
  replicas are extra computes on the **same** storage, so they do not replay WAL into
  their own copy: their lag and I/O profile differ from the streaming standby here.
  The primary/replica contention results show the effect of moving CPU-heavy reads off
  the primary compute; they do not measure Neon replica lag.
- **Parameters.** pgbench scripts derive ids with `sfperf.*()` SQL functions instead of
  sending literal text parameters; the plans are the same shapes but not byte-identical
  to what `@vercel/postgres` sends.
- **Expression-index statistics.** `CREATE INDEX CONCURRENTLY` does not ANALYZE. Until
  `ANALYZE users` runs, `LOWER(col) = $1` keeps a 0.5% selectivity guess.
