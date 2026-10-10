#!/usr/bin/env bash
# Build the API binary of a checkout with the perf-only pprof overlay.
#   usage: build.sh <repo-root> <output-binary>
# The overlay adds perf/backend/pprof/pprof_perf.go.txt as an extra file of
# package main at build time only; the checkout is not modified. pprof is
# only served when PPROF_ADDR is set, so the binary is otherwise identical.
set -euo pipefail
REPO=$(cd "${1:?repo root}" && pwd)
OUT=${2:?output binary}
HERE=$(cd "$(dirname "$0")/.." && pwd)
OVERLAY=$(mktemp --suffix=.json)
trap 'rm -f "$OVERLAY"' EXIT
printf '{"Replace":{"%s/BackEnd/zz_pprof_perf.go":"%s/pprof/pprof_perf.go.txt"}}' "$REPO" "$HERE" >"$OVERLAY"
cd "$REPO/BackEnd"
go build -overlay "$OVERLAY" -o "$OUT" .
echo "built $OUT from $REPO"
