#!/usr/bin/env bash
# Light k6 load + next-server CPU/RSS sampling for one version.
#   perf/frontend/k6/run-load.sh <label> <frontend-port> <cookie-file> <out-dir> [proxy|direct] [backend-url] [vus] [duration-s]
# direct mode (main) logs in to the backend to get a bearer token for heavy@perf.test.
set -euo pipefail
label="$1"; port="$2"; cookie_file="$3"; out="$4"; mode="${5:-proxy}"; backend="${6:-}"; vus="${7:-5}"; dur="${8:-60}"
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$out"
token=""
if [ "$mode" = direct ]; then
  token=$(curl -s -X POST "$backend/auth/login" -H 'content-type: application/json' \
    -d "$(printf '{"email":"heavy@perf.test","password":"%s"}' "${PERF_USER_PASSWORD:?export PERF_USER_PASSWORD}")" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).access_token))')
fi
node "$here/../sample-proc.mjs" --port "$port" --seconds $((dur + 8)) --out "$out/proc-$label.csv" > "$out/proc-$label.json" &
sampler=$!
sleep 2
docker run --rm -i --network host -v "$here:/scripts" grafana/k6 run --quiet \
  -e BASE="http://127.0.0.1:$port" -e COOKIE="$(cat "$cookie_file")" -e MODE="$mode" -e BACKEND="$backend" -e TOKEN="$token" \
  -e VUS="$vus" -e DURATION="${dur}s" --summary-export "/scripts/summary-$label.json" /scripts/pages.js > "$out/k6-$label.txt" 2>&1 || true
wait "$sampler"
mv "$here/summary-$label.json" "$out/k6-summary-$label.json" 2>/dev/null || true
cat "$out/proc-$label.json"
