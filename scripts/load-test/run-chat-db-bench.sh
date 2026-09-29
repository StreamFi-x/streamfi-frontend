#!/bin/sh
# Chat-poll database benchmark (#1410). Throwaway databases only: it seeds and
# drops tables. Needs psql + pgbench (both ship in the postgres Docker image).
#
#   BENCH_DATABASE_URL=postgres://postgres:pw@localhost:5432/bench \
#     sh scripts/load-test/run-chat-db-bench.sh [pool_size] [pbmax] [seconds]
#
# pool_size  server connections, i.e. the PgBouncer/Neon pooler pool (default 20)
# pbmax      1 = every viewer on one busy stream, 200 = viewers spread (default 1)
# seconds    duration per step (default 15)
#
# Each step offers VIEWERS polls/second (the pre-#1410 client: one poll per
# viewer per second, no shared cache) and reports what the database sustained.
set -eu
: "${BENCH_DATABASE_URL:?set BENCH_DATABASE_URL to a disposable database}"
POOL=${1:-20}
PBMAX=${2:-1}
SECS=${3:-15}
DIR=$(cd "$(dirname "$0")" && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

printf '%8s %9s %9s %8s %8s %8s %8s %7s\n' viewers offered achieved avg_ms p95_ms p99_ms lag_ms failed
for VIEWERS in ${VIEWER_STEPS:-100 250 500 1000 2000 4000}; do
  rm -f "$WORK"/log*
  OUT=$(cd "$WORK" && pgbench "$BENCH_DATABASE_URL" -n -M prepared -c "$POOL" -j 4 \
    -T "$SECS" -R "$VIEWERS" -D pbmax="$PBMAX" -l --log-prefix=log \
    -f "$DIR/chat-poll.pgbench" 2>&1) || true
  TPS=$(printf '%s\n' "$OUT" | awk '/^tps/ {print $3; exit}')
  LAG=$(printf '%s\n' "$OUT" | awk '/rate limit schedule lag: avg/ {print $6; exit}')
  FAILED=$(printf '%s\n' "$OUT" | awk '/number of failed transactions/ {print $5; exit}')
  # Per-transaction log: field 3 is latency in microseconds.
  STATS=$(cat "$WORK"/log* 2>/dev/null | awk '{print $3}' | sort -n | awk '
    { v[NR] = $1; s += $1 }
    END { if (NR == 0) { print "- - -"; exit }
          p95 = v[int(NR * 0.95)]; p99 = v[int(NR * 0.99)]
          printf "%.2f %.2f %.2f", s / NR / 1000, p95 / 1000, p99 / 1000 }')
  set -- $STATS
  printf '%8s %9s %9.0f %8s %8s %8s %8s %7s\n' "$VIEWERS" "$VIEWERS" "${TPS:-0}" "$1" "$2" "$3" "${LAG:--}" "${FAILED:-0}"
done
