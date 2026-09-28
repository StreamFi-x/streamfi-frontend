#!/usr/bin/env bash
# Primary-vs-replica contention load test (pgbench from sfperf-client).
#   S1  chat_read (Q2 + Q1b keyset)           32 clients -> primary          (baseline)
#   S2  S1 + analytics (Q11 + Q12) 8 clients  -> primary, + chat_write 4 clients (WRITE_RATE tps) -> primary
#   S3  S1 + analytics 8 clients -> REPLICA,  + chat_write 4 clients (WRITE_RATE tps) -> primary
# Also: hot   users.current_viewers UPDATE TPS + HOT ratio with / without idx_users_live_viewers
# Usage: scripts/perf/run-loadtest.sh [S1 S2 S3 hot]   (default: S1 S2 S3)
# Env: DURATION (default 60), OUT (results dir)
set -euo pipefail
export MSYS_NO_PATHCONV=1

HERE=$(cd "$(dirname "$0")" && pwd)
OUT=${OUT:-${PERF_RESULTS:-$HERE/results}}
DURATION=${DURATION:-60}
WRITE_RATE=${WRITE_RATE:-20}   # chat INSERT tps target for S2/S3 (latency in the log includes schedule lag if the target is missed)
CLIENT=sfperf-client
PRIMARY=sfperf-primary
REPLICA=sfperf-replica
SCENARIOS=${*:-S1 S2 S3}
mkdir -p "$OUT"

docker exec "$CLIENT" mkdir -p /lt
for f in "$HERE"/loadtest/*.sql; do
  src=$f; command -v cygpath >/dev/null && src=$(cygpath -w "$f")   # Git Bash: docker.exe needs a Windows path
  docker cp "$src" "$CLIENT:/lt/$(basename "$f")" >/dev/null
done

cpsql() { docker exec -i "$CLIENT" psql -h "$1" -X -qAt -v ON_ERROR_STOP=1 "${@:2}"; }

# pgbench <tag> <host> <script> <clients> <threads> [extra args...]
bench() {
  local tag=$1 host=$2 script=$3 clients=$4 threads=$5; shift 5
  docker exec "$CLIENT" bash -c "rm -f /lt/log_${tag}*; cd /lt && pgbench -h $host -n -M prepared -r \
      -c $clients -j $threads -T $DURATION -f /lt/$script --log --log-prefix=/lt/log_${tag} $*" \
      > "$OUT/pgbench-${tag}.txt" 2>&1
}

# latency percentiles (ms) from pgbench per-transaction logs (column 3 = latency in us)
pctl() {
  docker exec "$CLIENT" bash -c "cat /lt/log_$1.* | awk '{print \$3}' | sort -n > /lt/lat_$1.txt; \
    n=\$(wc -l < /lt/lat_$1.txt); \
    awk -v n=\$n 'BEGIN{i50=int(n*0.50); i95=int(n*0.95); i99=int(n*0.99); if(i50<1)i50=1; if(i95<1)i95=1; if(i99<1)i99=1}
      {s+=\$1; m=\$1} NR==i50{p50=\$1} NR==i95{p95=\$1} NR==i99{p99=\$1}
      END{printf \"n=%d avg_ms=%.2f p50_ms=%.2f p95_ms=%.2f p99_ms=%.2f max_ms=%.2f\n\", n, s/n/1000, p50/1000, p95/1000, p99/1000, m/1000}' /lt/lat_$1.txt"
}

tps() { grep -m1 -E '^tps = ' "$OUT/pgbench-$1.txt" | sed -E 's/^tps = ([0-9.]+).*/\1/'; }

lag_sampler() {   # $1 = tag; samples ~every second until DURATION s have elapsed
  local tag=$1
  docker exec "$CLIENT" bash -c "end=\$((\$(date +%s) + $DURATION)); while [ \$(date +%s) -lt \$end ]; do
      r=\$(psql -h $REPLICA -X -qAt -c \"SELECT round(extract(epoch FROM now() - pg_last_xact_replay_timestamp())*1000)::bigint || '|' || pg_wal_lsn_diff(pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn())\");
      p=\$(psql -h $PRIMARY -X -qAt -c \"SELECT coalesce(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn),0) || '|' || coalesce(round(extract(epoch FROM replay_lag)*1000),0) FROM pg_stat_replication LIMIT 1\");
      echo \"\$(date +%s)|\$r|\$p\"; sleep 1; done" > "$OUT/replica-lag-${tag}.psv"
}

lag_summary() {   # skips the first 3 samples (before the first replicated write); columns: epoch|replay_ts_age_ms|recv_minus_replay_bytes|primary_minus_replay_bytes|replay_lag_ms
  awk -F'|' 'NF>=5 && NR>3 {n++; a+=$2; if($2>am)am=$2; b+=$3; if($3>bm)bm=$3; c+=$4; if($4>cm)cm=$4; d+=$5; if($5>dm)dm=$5}
    END { if(n) printf "samples=%d replay_ts_age_ms avg=%.0f max=%d | recv-replay bytes avg=%.0f max=%d | primary-replay bytes avg=%.0f max=%d | pg_stat_replication.replay_lag_ms avg=%.1f max=%d\n", n, a/n, am, b/n, bm, c/n, cm, d/n, dm }' "$1"
}

SUMMARY="$OUT/loadtest-summary.txt"
echo "# run $(date -u +%FT%TZ) duration=${DURATION}s" >> "$SUMMARY"

cleanup_writes() {
  cpsql "$PRIMARY" -c "DELETE FROM chat_messages WHERE content = 'sfperf loadtest message'" -c "VACUUM (ANALYZE) chat_messages" >/dev/null
}

for sc in $SCENARIOS; do
  case $sc in
    S1)
      bench S1_chat "$PRIMARY" chat_read.sql 32 4
      echo "S1 chat(primary):      tps=$(tps S1_chat) $(pctl S1_chat)" | tee -a "$SUMMARY"
      ;;
    S2)
      cpsql "$REPLICA" -c "SELECT pg_stat_reset()" >/dev/null
      lag_sampler S2 & lp=$!
      bench S2_chat "$PRIMARY" chat_read.sql 32 4 & p1=$!
      bench S2_analytics "$PRIMARY" analytics.sql 8 2 & p2=$!
      bench S2_write "$PRIMARY" chat_write.sql 4 1 -R $WRITE_RATE & p3=$!
      wait $p1 $p2 $p3 $lp
      echo "S2 chat(primary):      tps=$(tps S2_chat) $(pctl S2_chat)" | tee -a "$SUMMARY"
      echo "S2 analytics(primary): tps=$(tps S2_analytics) $(pctl S2_analytics)" | tee -a "$SUMMARY"
      echo "S2 write(primary):     tps=$(tps S2_write) $(pctl S2_write)" | tee -a "$SUMMARY"
      echo "S2 replica lag:        $(lag_summary "$OUT/replica-lag-S2.psv")" | tee -a "$SUMMARY"
      cleanup_writes
      ;;
    S3)
      cpsql "$REPLICA" -c "SELECT pg_stat_reset()" >/dev/null
      lag_sampler S3 & lp=$!
      bench S3_chat "$PRIMARY" chat_read.sql 32 4 & p1=$!
      bench S3_analytics "$REPLICA" analytics.sql 8 2 & p2=$!
      bench S3_write "$PRIMARY" chat_write.sql 4 1 -R $WRITE_RATE & p3=$!
      wait $p1 $p2 $p3 $lp
      echo "S3 chat(primary):      tps=$(tps S3_chat) $(pctl S3_chat)" | tee -a "$SUMMARY"
      echo "S3 analytics(replica): tps=$(tps S3_analytics) $(pctl S3_analytics)" | tee -a "$SUMMARY"
      echo "S3 write(primary):     tps=$(tps S3_write) $(pctl S3_write)" | tee -a "$SUMMARY"
      echo "S3 replica lag:        $(lag_summary "$OUT/replica-lag-S3.psv")" | tee -a "$SUMMARY"
      echo "S3 replica conflicts:  $(cpsql "$REPLICA" -c "SELECT 'confl_snapshot=' || confl_snapshot || ' confl_lock=' || confl_lock || ' confl_bufferpin=' || confl_bufferpin FROM pg_stat_database_conflicts WHERE datname = 'streamfi'")" | tee -a "$SUMMARY"
      cleanup_writes
      ;;
    hot)
      # users.current_viewers write cost with and without idx_users_live_viewers.
      hot_run() {   # $1 = tag
        cpsql "$PRIMARY" -c "VACUUM users" -c "SELECT pg_stat_reset_single_table_counters('users'::regclass)" >/dev/null
        local lsn0 idx0 st wal idx1
        lsn0=$(cpsql "$PRIMARY" -c "SELECT pg_current_wal_lsn()")
        idx0=$(cpsql "$PRIMARY" -c "SELECT pg_indexes_size('users')")
        bench "$1" "$PRIMARY" viewer_count_update.sql 16 4
        sleep 1
        wal=$(cpsql "$PRIMARY" -c "SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), '$lsn0')")
        idx1=$(cpsql "$PRIMARY" -c "SELECT pg_indexes_size('users')")
        st=$(cpsql "$PRIMARY" -c "SELECT 'n_tup_upd=' || n_tup_upd || ' n_tup_hot_upd=' || n_tup_hot_upd || ' hot_ratio=' || round(100.0 * n_tup_hot_upd / nullif(n_tup_upd, 0), 1) || '%' FROM pg_stat_user_tables WHERE relname = 'users'")
        echo "$1: tps=$(tps "$1") $(pctl "$1") $st wal_bytes_per_update=$(( wal / $(grep -m1 'number of transactions actually processed' "$OUT/pgbench-$1.txt" | awk '{print $NF}' | cut -d/ -f1) )) users_index_growth_bytes=$(( idx1 - idx0 ))" | tee -a "$SUMMARY"
      }
      cpsql "$PRIMARY" -c "DROP INDEX IF EXISTS idx_users_live_viewers" >/dev/null
      DURATION_SAVE=$DURATION; DURATION=20; bench hot_warmup "$PRIMARY" viewer_count_update.sql 16 4; DURATION=$DURATION_SAVE
      hot_run hot_without_idx
      cpsql "$PRIMARY" -c "CREATE INDEX IF NOT EXISTS idx_users_live_viewers ON users (current_viewers DESC) WHERE is_live" >/dev/null
      hot_run hot_with_idx
      cpsql "$PRIMARY" -c "DROP INDEX IF EXISTS idx_users_live_viewers" >/dev/null
      hot_run hot_without_idx_again
      ;;
    *) echo "unknown scenario $sc" >&2; exit 1 ;;
  esac
done
