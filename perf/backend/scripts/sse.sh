#!/usr/bin/env bash
# SSE connection overhead for one backend.
#   usage: sse.sh <out-dir> <name> <base-url> <pprof-addr> <pg-container> <backend-log> ["0 500 1000"]
# For each connection count: runs k6/sse.js, and ~25s in (all streams open)
# samples the server's goroutines/heap (/debug/runtime), RSS and the number of
# Postgres backends. Writes <out>/sse/<name>-<conns>.json (+ .runtime.json).
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/env.sh"
OUT=$(mkdir -p "${1:?out}/sse" && cd "$1/sse" && pwd); NAME=${2:?}; BASE=${3:?}; PPROF=${4:?}; PGC=${5:?}; LOG=${6:?}
COUNTS=${7:-"0 500 1000"}
HERE=$(cd "$(dirname "$0")/.." && pwd)
for n in $COUNTS; do
  docker run --rm -i --user "$(id -u):$(id -g)" --network host -v "$HERE/k6:/scripts:ro" -v "$OUT:/out" \
    grafana/k6 run -q --no-color -e PASSWORD="$PERF_USER_PASSWORD" -e BASE="$BASE" -e CONNS="$n" -e HOLD=40 -e OUT="/out/$NAME-$n.json" /scripts/sse.js \
    >"$OUT/$NAME-$n.k6.log" 2>&1 &
  k6pid=$!
  sleep 45   # setup (201 logins) + streams opening
  pid=$(cat "$LOG.pid")
  {
    printf '{"conns":%s,"runtime":' "$n"
    curl -s -m 5 "http://$PPROF/debug/runtime" | tr -d '\n'
    printf ',"rss_kb":%s,"pg_backends":%s,"loadavg":"%s"}\n' \
      "$(ps -o rss= -p "$pid" | tr -d ' ')" \
      "$(docker exec "$PGC" psql -Atq -U postgres -d perf -c "select count(*) from pg_stat_activity where datname='perf'")" \
      "$(cut -d' ' -f1-3 /proc/loadavg)"
  } >"$OUT/$NAME-$n.runtime.json"
  wait "$k6pid" || true
  grep -E '^\{' "$OUT/$NAME-$n.k6.log" | sed "s/^/[$NAME conns=$n] /" || true
  cat "$OUT/$NAME-$n.runtime.json"
  sleep 5
done
