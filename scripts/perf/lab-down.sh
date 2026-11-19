#!/usr/bin/env bash
# Removes the perf lab: sfperf-* containers, the sfperf-net network and both data volumes.
# Touches nothing else. KEEP_VOLUMES=1 keeps the data volumes.
set -uo pipefail
export MSYS_NO_PATHCONV=1

for c in sfperf-client sfperf-replica sfperf-primary; do
  docker rm -f "$c" >/dev/null 2>&1 && echo "removed $c"
done
docker network rm sfperf-net >/dev/null 2>&1 && echo "removed network sfperf-net"
if [ "${KEEP_VOLUMES:-0}" != "1" ]; then
  for v in sfperf-replica-data sfperf-primary-data; do
    docker volume rm "$v" >/dev/null 2>&1 && echo "removed volume $v"
  done
fi
