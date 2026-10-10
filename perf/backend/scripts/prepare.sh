#!/usr/bin/env bash
# Prepare one version end-to-end: Postgres container (if missing) -> fresh DB
# -> build -> start backend (runs migrations) -> seed -> smoke check.
#   usage: prepare.sh <name> <repo-root> <pg-port> <http-port> <pprof-port> [bypassrls|norls]
#   e.g.   prepare.sh branch ~/src/GestorDePresupuesto 15441 18441 18451
#          prepare.sh main   /tmp/perf-main            15442 18442 18452
# Outputs (binary, logs) go to $PERF_OUT (default ./perf-out).
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/env.sh"
NAME=${1:?name}; REPO=$(cd "${2:?repo}" && pwd); PG=${3:?pg port}; PORT=${4:?http port}
PPROF=${5:?pprof port}; MODE=${6:-bypassrls}
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=${PERF_OUT:-$PWD/perf-out}; mkdir -p "$OUT/bin"
C=perf-be-pg-$PG
LOG="$OUT/backend-$NAME.log"

docker inspect "$C" >/dev/null 2>&1 || "$HERE/pg-up.sh" "$PG" "$C"
"$HERE/stop-backend.sh" "$LOG" || true
"$HERE/reset-db.sh" "$C" "$MODE"
[ -x "$OUT/bin/api-$NAME" ] && [ -z "${REBUILD:-}" ] || "$HERE/build.sh" "$REPO" "$OUT/bin/api-$NAME"
"$HERE/run-backend.sh" "$OUT/bin/api-$NAME" "$REPO/BackEnd" "$PG" "$PORT" "$LOG" "127.0.0.1:$PPROF"
docker exec -i "$C" psql -q -v ON_ERROR_STOP=1 -v perf_user_password="$PERF_USER_PASSWORD" -U postgres -d perf < "$HERE/../seed/seed.sql"
# restart so in-process caches start cold and identical for both versions
"$HERE/stop-backend.sh" "$LOG"
"$HERE/run-backend.sh" "$OUT/bin/api-$NAME" "$REPO/BackEnd" "$PG" "$PORT" "$LOG" "127.0.0.1:$PPROF"
docker exec "$C" psql -q -U postgres -d perf -c "SELECT pg_stat_statements_reset();" >/dev/null
"$HERE/smoke.sh" "http://127.0.0.1:$PORT"
