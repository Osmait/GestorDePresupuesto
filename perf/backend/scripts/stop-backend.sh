#!/usr/bin/env bash
# Stop a backend started by run-backend.sh.
#   usage: stop-backend.sh <log-file>   (reads <log-file>.pid)
set -euo pipefail
PIDF="${1:?log file}.pid"
if [ -f "$PIDF" ]; then
  PID=$(cat "$PIDF")
  kill "$PID" 2>/dev/null || true
  for _ in $(seq 1 40); do kill -0 "$PID" 2>/dev/null || break; sleep 0.25; done
  kill -9 "$PID" 2>/dev/null || true
  rm -f "$PIDF"
  echo "stopped $PID"
fi
