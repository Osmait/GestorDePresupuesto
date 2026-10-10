#!/usr/bin/env bash
# Run the k6 ladders for several endpoints against several versions,
# interleaved (round r: ep1/vA, ep1/vB, ep2/vA, ...; the version order flips
# every round) so machine noise hits both versions alike.
#
#   usage: run-matrix.sh <out-dir> "<run ids>" "<ep1 ep2 ...|all>" name=url=backend-log [...]
#   e.g.   run-matrix.sh ./results "1 2 3" all \
#            branch=http://127.0.0.1:18441=$PERF_OUT/backend-branch.log \
#            main=http://127.0.0.1:18442=$PERF_OUT/backend-main.log
#
# Env: STEP (s per rate, default 10), WARMUP (s, default 6), LIGHT_USERS (50),
#      PAUSE (s between runs, 3).
# Writes <out>/k6/<ep>-<name>-r<run>.json and appends one line per run to
# <out>/k6/runs.tsv (timestamp, ep, version, run, nproc, loadavg 1m 5m 15m).
#
# After every k6 run the backend is health-checked (POST /auth/login, 10s
# timeout). A wedged backend (the pool-exhaustion deadlock, see README) gets a
# goroutine dump in <out>/k6/hang-<ep>-<name>-r<run>.txt, a HANG line in
# runs.tsv, and is restarted with restart-backend.sh.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/env.sh"
OUT=$(mkdir -p "${1:?out}" && cd "$1" && pwd); RUNS=${2:?runs}; EPS=${3:?eps}; shift 3
HERE=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$OUT/k6"
declare -a NAMES URLS LOGS
for kv in "$@"; do
  NAMES+=("${kv%%=*}"); rest=${kv#*=}; URLS+=("${rest%%=*}"); LOGS+=("${rest#*=}")
done
if [ "$EPS" = all ]; then EPS=$(grep -v '^#' "$HERE/k6/ladders.conf" | awk 'NF{print $1}' | tr '\n' ' '); fi

healthy() {
  curl -fsS -m 10 -o /dev/null -X POST "$1/auth/login" -H 'Content-Type: application/json' \
    -d "$(login_body light001@perf.test)"
}

for run in $RUNS; do
  for ep in $EPS; do
    rates=$(awk -v e="$ep" '$1==e{print $2}' "$HERE/k6/ladders.conf")
    maxvus=$(awk -v e="$ep" '$1==e{print $3}' "$HERE/k6/ladders.conf")
    [ -n "$rates" ] || { echo "no ladder for $ep" >&2; exit 1; }
    order=$(seq 0 $((${#NAMES[@]} - 1)))
    if [ $((run % 2)) -eq 0 ]; then order=$(echo "$order" | tac); fi
    for i in $order; do
      name=${NAMES[$i]}; url=${URLS[$i]}; log=${LOGS[$i]}
      printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$(date -Is)" "$ep" "$name" "$run" "$(nproc)" "$(cut -d' ' -f1-3 /proc/loadavg)" >>"$OUT/k6/runs.tsv"
      docker run --rm -i --user "$(id -u):$(id -g)" --network host \
        -v "$HERE/k6:/scripts:ro" -v "$OUT/k6:/out" grafana/k6 run -q --no-color -e PASSWORD="$PERF_USER_PASSWORD" \
        -e BASE="$url" -e EP="$ep" -e RATES="$rates" -e STEP="${STEP:-10}" -e WARMUP="${WARMUP:-6}" \
        -e MAX_VUS="${maxvus:-800}" -e LIGHT_USERS="${LIGHT_USERS:-50}" \
        -e OUT="/out/$ep-$name-r$run.json" /scripts/ladder.js 2>&1 \
        | grep -E '^\{' | sed "s/^/[$name r$run] /" || true
      if ! healthy "$url"; then
        pprof=$(awk '{print $6}' "$log.args" | tr -d "'")
        curl -s -m 10 "http://$pprof/debug/pprof/goroutine?debug=1" >"$OUT/k6/hang-$ep-$name-r$run.txt" || true
        printf '%s\t%s\t%s\t%s\tHANG\n' "$(date -Is)" "$ep" "$name" "$run" >>"$OUT/k6/runs.tsv"
        echo "[$name r$run] $ep: backend wedged -> goroutine dump saved, restarting"
        "$HERE/scripts/restart-backend.sh" "$log"
      fi
      sleep "${PAUSE:-3}"
    done
  done
done
