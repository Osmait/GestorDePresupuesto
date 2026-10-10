#!/usr/bin/env bash
# Run an API binary against a perf Postgres with the shared perf env.
#   usage: run-backend.sh <binary> <backend-dir(cwd)> <pg-port> <http-port> <log-file> [pprof-addr]
# cwd matters for `main`: its migrations are read from
# file://cmd/api/db/migrations (not embedded), so cwd must be its BackEnd dir.
#
# Knobs changed vs. defaults (identical for both versions):
#   RATE_LIMIT_ENABLED=false   global sliding-window limiter off (with it on,
#                              127.0.0.1 is whitelisted by default anyway)
#   OTEL_ENABLE_STDOUT=false   no stdout exporter
#   ADMIN_SEED_ENABLED=false   (ADMIN_ENABLED=false also exported, unused)
#   GIN_MODE=release           no debug route dump
#   DB_MAX_OPEN_CONNS=25 DB_MAX_IDLE_CONNS=25 DB_CONN_MAX_LIFETIME=5m
#   DB_CONN_MAX_IDLE_TIME=5m   (= the defaults, set explicitly)
#   JWT_EXPIRATION=24h         long enough for a whole run
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/env.sh"
BIN=${1:?binary}; DIR=${2:?cwd}; PG=${3:?pg port}; PORT=${4:?http port}; LOG=${5:?log}
PPROF=${6:-}
# remember how to restart this backend (used by restart-backend.sh)
printf '%q ' "$@" >"$LOG.args"
cd "$DIR"
env -i PATH="$PATH" HOME="$HOME" \
  ENV=test DB_TYPE=postgres DB_HOST=127.0.0.1 DB_PORT="$PG" DB_NAME=perf DB_USER=perf \
  DB_PASSWORD="$PERF_DB_PASSWORD" DB_SSL_MODE=disable \
  JWT_SECRET=perf-jwt-secret-must-be-at-least-32-characters-long JWT_EXPIRATION=24h \
  SERVER_PORT="$PORT" SERVER_HOST=127.0.0.1 GEMINI_API_KEY= \
  ADMIN_ENABLED=false ADMIN_SEED_ENABLED=false \
  RATE_LIMIT_ENABLED=false OTEL_ENABLE_STDOUT=false GIN_MODE=release LOG_LEVEL=info \
  DB_MAX_OPEN_CONNS=25 DB_MAX_IDLE_CONNS=25 DB_CONN_MAX_LIFETIME=5m DB_CONN_MAX_IDLE_TIME=5m \
  PPROF_ADDR="$PPROF" \
  nohup "$BIN" >>"$LOG" 2>&1 &
echo $! >"$LOG.pid"
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    echo "up on :$PORT (pid $(cat "$LOG.pid"))"; exit 0
  fi
  sleep 0.5
done
echo "backend did not come up; tail of $LOG:" >&2; tail -30 "$LOG" >&2; exit 1
