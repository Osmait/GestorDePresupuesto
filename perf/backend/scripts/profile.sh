#!/usr/bin/env bash
# Profile one backend under the mixed workload at a constant arrival rate.
#   usage: profile.sh <out-dir> <name> <base-url> <pprof-addr> <pg-container> [rate] [ep]
# Collects into <out>/profile/<name>-<ep>-<rate>/:
#   cpu.pprof (30s), heap.pprof, allocs.pprof, mutex.pprof, block.pprof,
#   goroutine.txt, runtime-{start,end}.json (alloc/GC deltas over the same
#   30s window -> allocations per request), pg_activity.tsv (connection
#   states sampled every 2s), pgss_total.csv / pgss_mean.csv
#   (pg_stat_statements, reset right before the run), k6.json.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/env.sh"
OUT=${1:?out}; NAME=${2:?}; BASE=${3:?}; PPROF=${4:?}; PGC=${5:?}; RATE=${6:-200}; EP=${7:-mixed}
HERE=$(cd "$(dirname "$0")/.." && pwd)
D="$OUT/profile/$NAME-$EP-$RATE"; mkdir -p "$D"; D=$(cd "$D" && pwd)
DUR=75

docker exec "$PGC" psql -Atq -U postgres -d perf -c "SELECT pg_stat_statements_reset();" >/dev/null
docker run --rm -i --user "$(id -u):$(id -g)" --network host -v "$HERE/k6:/scripts:ro" -v "$D:/out" \
  grafana/k6 run -q --no-color -e PASSWORD="$PERF_USER_PASSWORD" -e BASE="$BASE" -e EP="$EP" -e RATES="$RATE" -e STEP="$DUR" -e WARMUP=5 \
  -e LIGHT_USERS=50 -e ACCEPT_ENCODING="${ACCEPT_ENCODING:-}" -e OUT=/out/k6.json /scripts/ladder.js >"$D/k6.log" 2>&1 &
k6pid=$!
sleep 30   # setup (logins) + warm-up
(
  for _ in $(seq 1 20); do
    docker exec "$PGC" psql -Atq -F $'\t' -U postgres -d perf -c \
      "select now()::time(0), state, coalesce(wait_event_type,'-'), coalesce(wait_event,'-'), count(*) from pg_stat_activity where datname='perf' and pid<>pg_backend_pid() group by 2,3,4" >>"$D/pg_activity.tsv"
    sleep 2
  done
) &
samp=$!
curl -s "http://$PPROF/debug/runtime" >"$D/runtime-start.json"
curl -s "http://$PPROF/debug/pprof/profile?seconds=30" >"$D/cpu.pprof"
curl -s "http://$PPROF/debug/runtime" >"$D/runtime-end.json"
curl -s "http://$PPROF/debug/pprof/heap" >"$D/heap.pprof"
curl -s "http://$PPROF/debug/pprof/allocs" >"$D/allocs.pprof"
curl -s "http://$PPROF/debug/pprof/mutex" >"$D/mutex.pprof"
curl -s "http://$PPROF/debug/pprof/block" >"$D/block.pprof"
curl -s "http://$PPROF/debug/pprof/goroutine?debug=1" >"$D/goroutine.txt"
wait "$samp" || true
wait "$k6pid" || true
grep -E '^\{' "$D/k6.log" || true
"$HERE/scripts/pgss-dump.sh" "$PGC" "$D"
docker exec "$PGC" psql -q --csv -U postgres -d perf -c "SELECT * FROM pg_stat_wal" >"$D/pg_stat_wal.csv" || true
echo "profile written to $D"
