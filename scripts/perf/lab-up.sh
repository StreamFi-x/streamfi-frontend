#!/usr/bin/env bash
# StreamFi Postgres perf lab: primary + streaming hot standby + pgbench client.
# Idempotent: re-running leaves healthy containers alone and only creates what is missing.
#
#   PRIMARY_PORT (default 55462)  host port for sfperf-primary
#   REPLICA_PORT (default 55463)  host port for sfperf-replica
#
# Default ports are NOT 55432/55433 because 55432 is already bound on the reference
# host by an unrelated container (intent-postgres). Override if you have them free.
set -euo pipefail
export MSYS_NO_PATHCONV=1

IMAGE=${IMAGE:-postgres:16}
NET=sfperf-net
PRIMARY=sfperf-primary
REPLICA=sfperf-replica
CLIENT=sfperf-client
PRIMARY_PORT=${PRIMARY_PORT:-55462}
REPLICA_PORT=${REPLICA_PORT:-55463}
PGPASS=${SFPERF_PASSWORD:-sfperf}
REPL_PASS=${SFPERF_REPL_PASSWORD:-sfperf_repl}
DB=streamfi

PG_SETTINGS=(
  -c shared_buffers=512MB
  -c effective_cache_size=3GB
  -c work_mem=16MB
  -c maintenance_work_mem=512MB
  -c max_connections=200
  -c wal_level=replica
  -c max_wal_senders=5
  -c max_replication_slots=5
  -c max_wal_size=1GB
  -c wal_compression=lz4
  -c hot_standby=on
  -c shared_preload_libraries=pg_stat_statements
  -c pg_stat_statements.track=all
  -c track_io_timing=on
  -c random_page_cost=1.1
  -c jit=off
)

exists()  { docker container inspect "$1" >/dev/null 2>&1; }
running() { [ "$(docker container inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" = "true" ]; }

wait_ready() {
  local name=$1
  for _ in $(seq 1 90); do
    if docker exec "$name" pg_isready -U postgres -q 2>/dev/null; then return 0; fi
    sleep 1
  done
  echo "timeout waiting for $name" >&2
  docker logs --tail 50 "$name" >&2
  return 1
}

psqlp() { docker exec -i "$PRIMARY" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -qAt "$@"; }
psqlr() { docker exec -i "$REPLICA" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -qAt "$@"; }

docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null

# ---------------------------------------------------------------- primary
if ! exists "$PRIMARY"; then
  docker run -d --name "$PRIMARY" --network "$NET" \
    --cpuset-cpus 0-3 --memory 4g --shm-size 1g \
    -p "${PRIMARY_PORT}:5432" \
    -e POSTGRES_PASSWORD="$PGPASS" -e POSTGRES_DB="$DB" \
    -v sfperf-primary-data:/var/lib/postgresql/data \
    "$IMAGE" "${PG_SETTINGS[@]}" >/dev/null
elif ! running "$PRIMARY"; then
  docker start "$PRIMARY" >/dev/null
fi
wait_ready "$PRIMARY"
# initdb runs a temporary server first; wait until the final server accepts TCP on the network.
for _ in $(seq 1 30); do
  docker exec "$PRIMARY" psql -U postgres -h 127.0.0.1 -d "$DB" -qAtc 'select 1' >/dev/null 2>&1 && break
  sleep 1
done

psqlp <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'replicator') THEN
    CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD '${REPL_PASS}';
  END IF;
END \$\$;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SQL

if ! docker exec "$PRIMARY" grep -q '^host replication replicator samenet' /var/lib/postgresql/data/pg_hba.conf; then
  docker exec "$PRIMARY" bash -c "echo 'host replication replicator samenet scram-sha-256' >> /var/lib/postgresql/data/pg_hba.conf"
  psqlp -c 'SELECT pg_reload_conf()' >/dev/null
fi

# ---------------------------------------------------------------- replica
if ! exists "$REPLICA"; then
  docker volume rm sfperf-replica-data >/dev/null 2>&1 || true
  docker volume create sfperf-replica-data >/dev/null
  psqlp -c "SELECT pg_drop_replication_slot('sfperf_replica') FROM pg_replication_slots WHERE slot_name='sfperf_replica'" >/dev/null
  docker run --rm --network "$NET" -v sfperf-replica-data:/var/lib/postgresql/data "$IMAGE" bash -c "
    set -e
    chown postgres:postgres /var/lib/postgresql/data && chmod 700 /var/lib/postgresql/data
    gosu postgres pg_basebackup -d 'host=$PRIMARY port=5432 user=replicator password=$REPL_PASS' \
      -D /var/lib/postgresql/data -R -X stream -C -S sfperf_replica -c fast -P"
  docker run -d --name "$REPLICA" --network "$NET" \
    --cpuset-cpus 4-7 --memory 4g --shm-size 1g \
    -p "${REPLICA_PORT}:5432" \
    -e POSTGRES_PASSWORD="$PGPASS" \
    -v sfperf-replica-data:/var/lib/postgresql/data \
    "$IMAGE" "${PG_SETTINGS[@]}" -c hot_standby_feedback=off >/dev/null
elif ! running "$REPLICA"; then
  docker start "$REPLICA" >/dev/null
fi
wait_ready "$REPLICA"

# ---------------------------------------------------------------- client
if ! exists "$CLIENT"; then
  docker run -d --name "$CLIENT" --network "$NET" --cpuset-cpus 8-11 --memory 2g \
    -e PGPASSWORD="$PGPASS" -e PGUSER=postgres -e PGDATABASE="$DB" \
    --entrypoint sleep "$IMAGE" infinity >/dev/null
elif ! running "$CLIENT"; then
  docker start "$CLIENT" >/dev/null
fi

# ---------------------------------------------------------------- verify replication
in_recovery=$(psqlr -c 'SELECT pg_is_in_recovery()')
echo "replica pg_is_in_recovery() = $in_recovery"
[ "$in_recovery" = "t" ] || { echo "replica is not in recovery" >&2; exit 1; }

token="lab-up-$(date +%s)-$RANDOM"
psqlp -c "CREATE TABLE IF NOT EXISTS sfperf_repl_probe (token text PRIMARY KEY, at timestamptz DEFAULT now())" \
      -c "INSERT INTO sfperf_repl_probe(token) VALUES ('$token')" >/dev/null
seen=""
for _ in $(seq 1 30); do
  seen=$(psqlr -c "SELECT token FROM sfperf_repl_probe WHERE token='$token'" 2>/dev/null || true)
  [ "$seen" = "$token" ] && break
  sleep 0.5
done
[ "$seen" = "$token" ] || { echo "write on primary did not reach replica" >&2; exit 1; }
echo "replication probe: row '$token' written on primary is visible on replica"
psqlp -c "SELECT application_name, state, sync_state, pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS replay_lag_bytes FROM pg_stat_replication"
docker exec "$CLIENT" pgbench --version

cat <<EOF
lab ready:
  $PRIMARY  localhost:$PRIMARY_PORT  (cpus 0-3, 4g)   postgres://postgres:$PGPASS@localhost:$PRIMARY_PORT/$DB
  $REPLICA  localhost:$REPLICA_PORT  (cpus 4-7, 4g)   hot standby, slot sfperf_replica
  $CLIENT   (cpus 8-11)             docker exec -it $CLIENT psql -h $PRIMARY
EOF
