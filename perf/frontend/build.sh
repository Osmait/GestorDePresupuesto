#!/usr/bin/env bash
# Production build of a gestor checkout, optionally with the bundle analyzer.
#
#   perf/frontend/build.sh <gestor-dir> <label> [analyze] [out-dir]
#
# - <gestor-dir>: path to FrontendNextjs/gestor of the checkout to build
# - <label>:      name used for output files (e.g. branch, main)
# - analyze:      pass "analyze" to set ANALYZE=true (needs @next/bundle-analyzer
#                 and the next.config.js wrapper; reports land in .next/analyze)
# - out-dir:      where to copy build-output.txt / analyzer html / stats
#                 (default: $PERF_OUT or ./perf-results)
#
# Env passed through: NEXT_PUBLIC_BACKEND_URL (needed by `main`, which inlines it
# at build time). The branch only reads BACKEND_URL at runtime.
set -euo pipefail
dir="$1"; label="$2"; mode="${3:-}"; out="${4:-${PERF_OUT:-./perf-results}}"
mkdir -p "$out/bundles"
cd "$dir"
rm -rf .next
export NEXT_TELEMETRY_DISABLED=1
if [ "$mode" = analyze ]; then
  ANALYZE=true npx next build 2>&1 | tee "$out/bundles/build-output-$label-analyze.txt"
  for f in client nodejs edge; do
    [ -f ".next/analyze/$f.html" ] && cp ".next/analyze/$f.html" "$out/bundles/analyzer-$label-$f.html"
  done
else
  npx next build 2>&1 | tee "$out/bundles/build-output-$label.txt"
fi
# Raw chunk sizes (uncompressed + gzip) of every client chunk, for diffing.
find .next/static/chunks -name '*.js' -printf '%s %p\n' | while read -r size path; do
  gz=$(gzip -c -9 "$path" | wc -c)
  echo "$size,$gz,${path#.next/static/chunks/}"
done | sort -t, -k1 -nr > "$out/bundles/chunks-$label.csv"
cp .next/app-build-manifest.json "$out/bundles/app-build-manifest-$label.json" 2>/dev/null || true
cp .next/build-manifest.json "$out/bundles/build-manifest-$label.json" 2>/dev/null || true
echo "done: $label"
