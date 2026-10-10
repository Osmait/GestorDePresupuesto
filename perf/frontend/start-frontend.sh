#!/usr/bin/env bash
# Starts `next start` for an already built gestor checkout in the background.
#
#   perf/frontend/start-frontend.sh <gestor-dir> <port> <backend-url> <log-file>
#
# Sets both BACKEND_URL (branch, server-side proxy) and NEXT_PUBLIC_BACKEND_URL
# (main, inlined at build time; must match what build.sh was given).
# Writes the PID to <log-file>.pid.
set -euo pipefail
dir="$1"; port="$2"; backend="$3"; log="$4"
cd "$dir"
AUTH_SECRET="${AUTH_SECRET:-perf-auth-secret-0123456789abcdef}" \
AUTH_TRUST_HOST=true \
BACKEND_URL="$backend" \
NEXT_PUBLIC_BACKEND_URL="$backend" \
NEXT_TELEMETRY_DISABLED=1 \
NODE_ENV=production \
nohup npx next start -p "$port" -H 127.0.0.1 > "$log" 2>&1 &
echo $! > "$log.pid"
for i in $(seq 1 60); do
  if curl -s -o /dev/null "http://127.0.0.1:$port/login"; then echo "up on $port"; exit 0; fi
  sleep 1
done
echo "frontend on $port did not come up"; tail -n 30 "$log"; exit 1
