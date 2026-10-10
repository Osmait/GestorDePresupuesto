#!/usr/bin/env bash
# Full branch-vs-main comparison: for every round, reseed both databases and
# restart both backends, then run every ladder interleaved (run-matrix.sh).
#
#   usage: compare.sh <branch-repo> <main-repo> "<run ids>" [ep list|all]
#   env:   PERF_OUT (default ./perf-out) - binaries, backend logs, k6 results
#          REBUILD=1 to force rebuilding the binaries
#
# Ports: Postgres 15441 (branch) / 15442 (main), HTTP 18441 / 18442,
# pprof 18451 / 18452.
set -euo pipefail
BR=$(cd "${1:?branch repo}" && pwd); MR=$(cd "${2:?main repo}" && pwd); RUNS=${3:-"1 2 3"}; EPS=${4:-all}
HERE=$(cd "$(dirname "$0")" && pwd)
export PERF_OUT=${PERF_OUT:-$PWD/perf-out}
mkdir -p "$PERF_OUT"
for r in $RUNS; do
  echo "=== round $r: reseeding both versions"
  "$HERE/prepare.sh" branch "$BR" 15441 18441 18451 >/dev/null
  "$HERE/prepare.sh" main "$MR" 15442 18442 18452 >/dev/null
  "$HERE/run-matrix.sh" "$PERF_OUT/results" "$r" "$EPS" \
    "branch=http://127.0.0.1:18441=$PERF_OUT/backend-branch.log" \
    "main=http://127.0.0.1:18442=$PERF_OUT/backend-main.log"
done
