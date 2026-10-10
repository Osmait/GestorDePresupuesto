#!/usr/bin/env bash
# Start a Postgres 17 container tuned identically for perf runs.
#   usage: pg-up.sh <host-port> [container-name]
# Creates a NON-superuser role "perf" that owns database "perf", so the
# FORCE ROW LEVEL SECURITY policies are actually evaluated (a superuser would
# bypass RLS and make the numbers optimistic). pg_stat_statements is enabled.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/env.sh"
PORT=${1:?port}
NAME=${2:-perf-be-pg-$PORT}

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -p 127.0.0.1:"$PORT":5432 \
  -e POSTGRES_HOST_AUTH_METHOD=trust --shm-size=1g \
  postgres:17-alpine \
  -c shared_preload_libraries=pg_stat_statements \
  -c pg_stat_statements.track=all \
  -c pg_stat_statements.max=10000 \
  -c track_io_timing=on \
  -c max_connections=200 \
  -c shared_buffers=512MB \
  -c work_mem=8MB >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
sleep 2
docker exec "$NAME" psql -q -U postgres -c "CREATE ROLE perf LOGIN PASSWORD '$PERF_DB_PASSWORD' NOSUPERUSER;"
docker exec "$NAME" psql -q -U postgres -c "CREATE DATABASE perf OWNER perf;"
docker exec "$NAME" psql -q -U postgres -d perf -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
docker exec "$NAME" psql -q -U postgres -d perf -c "GRANT pg_read_all_stats TO perf;"
echo "postgres $NAME ready on 127.0.0.1:$PORT"
