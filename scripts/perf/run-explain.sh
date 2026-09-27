#!/usr/bin/env bash
# Runs scripts/perf/hot-queries.sql against sfperf-primary three times and keeps only the
# third run (warm cache). Writes:
#   $OUT/explain-<label>.txt          full EXPLAIN (ANALYZE, BUFFERS) output of run 3
#   $OUT/explain-<label>-summary.txt  per query: execution time, top-level buffers, scan nodes
# Usage: scripts/perf/run-explain.sh <label> [queries.sql]
set -euo pipefail
export MSYS_NO_PATHCONV=1

LABEL=${1:?usage: run-explain.sh <label> [queries.sql]}
HERE=$(cd "$(dirname "$0")" && pwd)
SQL=${2:-$HERE/hot-queries.sql}
OUT=${OUT:-${PERF_RESULTS:-$HERE/results}}
CONTAINER=${CONTAINER:-sfperf-primary}
mkdir -p "$OUT"

for run in 1 2 3; do
  docker exec -i "$CONTAINER" psql -U postgres -d streamfi -X -v ON_ERROR_STOP=1 < "$SQL" > "$OUT/explain-$LABEL.tmp" 2>&1 \
    || { cat "$OUT/explain-$LABEL.tmp" >&2; exit 1; }
done
mv "$OUT/explain-$LABEL.tmp" "$OUT/explain-$LABEL.txt"

summarize() {
  awk '
    /^### / { flush(); q=substr($0,5); t=""; buf=""; nodes=""; next }
    q=="" { next }
    /Execution Time:/ { t=$3 }
    buf=="" && /Buffers:/ { b=$0; sub(/^ *Buffers: */,"",b); buf=b }
    /(Seq Scan|Index Scan|Index Only Scan|Bitmap Heap Scan|Bitmap Index Scan|Sort Method|Incremental Sort)/ {
      n=$0; sub(/^[ ->]*/,"",n); sub(/  \(cost=.*$/,"",n); sub(/ \(cost=.*$/,"",n)
      if (index(nodes, n)==0) nodes = nodes (nodes==""?"":" | ") n
    }
    END { flush() }
    function flush() { if (q!="") printf "%s\n    exec_ms=%s  top_buffers=[%s]\n    nodes: %s\n", q, t, buf, nodes }
  ' "$1"
}
summarize "$OUT/explain-$LABEL.txt" > "$OUT/explain-$LABEL-summary.txt"
cat "$OUT/explain-$LABEL-summary.txt"
