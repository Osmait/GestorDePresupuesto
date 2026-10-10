#!/usr/bin/env bash
# Reproduce the connection-pool deadlock and record the evidence.
#   usage: deadlock.sh <out-dir> <name> <base-url> <pprof-addr> <pg-container> <backend-log> ["post get summary"] [vus]
# For each kind: 30 VUs for 15 s (10 s client timeout), then: is the server
# still able to serve a login 20 s later? goroutines parked in
# database/sql.(*DB).conn, Postgres sessions "idle in transaction".
# Wedged backends are restarted. Output: <out>/deadlock/<name>-<kind>.txt
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/env.sh"
OUT=$(mkdir -p "${1:?out}/deadlock" && cd "$1/deadlock" && pwd); NAME=${2:?}; BASE=${3:?}; PPROF=${4:?}; PGC=${5:?}; LOG=${6:?}
KINDS=${7:-"post get summary"}; VUS=${8:-30}
HERE=$(cd "$(dirname "$0")/.." && pwd)
for kind in $KINDS; do
  f="$OUT/$NAME-$kind.txt"
  {
    echo "# $NAME kind=$kind vus=$VUS $(date -Is) loadavg=$(cut -d' ' -f1-3 /proc/loadavg)"
    docker run --rm -i --network host -v "$HERE/k6:/scripts:ro" grafana/k6 run -q --no-color -e PASSWORD="$PERF_USER_PASSWORD" \
      -e BASE="$BASE" -e VUS="$VUS" -e KIND="$kind" /scripts/deadlock.js 2>&1 | grep -E '^\{' || true
    sleep 20
    if curl -fsS -m 10 -o /dev/null -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
         -d "$(login_body light001@perf.test)"; then
      echo "health after 20s: OK"; wedged=0
    else
      echo "health after 20s: WEDGED (login did not answer within 10s)"; wedged=1
    fi
    echo "goroutines total: $(curl -s -m 5 "http://$PPROF/debug/runtime" | sed -E 's/.*"goroutines":([0-9]+).*/\1/')"
    echo "goroutines parked in database/sql.(*DB).conn: $(curl -s -m 5 "http://$PPROF/debug/pprof/goroutine?debug=2" | grep -c 'database/sql.(\*DB).conn(' || true)"
    echo "postgres sessions by state:"
    docker exec "$PGC" psql -Atq -U postgres -d perf -c \
      "select coalesce(state,'-')||' '||count(*) from pg_stat_activity where datname='perf' and pid<>pg_backend_pid() group by state"
    if [ "$wedged" = 1 ]; then
      curl -s -m 5 "http://$PPROF/debug/pprof/goroutine?debug=1" >"$OUT/$NAME-$kind.goroutines.txt" || true
      echo "restarting backend"; "$HERE/scripts/restart-backend.sh" "$LOG"
    fi
  } >"$f" 2>&1
  cat "$f"
done
